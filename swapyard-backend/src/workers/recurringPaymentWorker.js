// src/workers/recurringPaymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const RecurringPayment = require("../models/RecurringPayment");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const GLOBAL_MARKUP = (() => {
  const v = process.env.MARKUP_PERCENT;
  return v ? parseFloat(v) : null;
})();

const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;
if (!SWAPYARD_WALLET_ID) {
  console.warn("⚠️ SWAPYARD_WALLET_ID is not set. Markup transfers will fail.");
}

// helper: safe numeric rounding (2 decimals)
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Consume recurringPaymentQueue
(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const {
      userId,
      walletId,      // ewallet id or internal wallet reference
      amount,
      currency,
      transactionId, // DB transaction _id (string)
      scheduleId,    // recurring schedule id
      retries = 0,
    } = job;

    console.log("🔁 recurringWorker: processing job", { transactionId, scheduleId, userId });

    // Fetch markup: env override -> DB per-type
    let markupPercent = GLOBAL_MARKUP;
    try {
      if (markupPercent === null) {
        const dbMarkup = await MarkupSetting.findOne({ type: "recurring" });
        markupPercent = dbMarkup ? dbMarkup.percentage : 0;
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch markupSetting, using 0:", err.message || err);
      markupPercent = markupPercent || 0;
    }

    markupPercent = Number(markupPercent || 0);
    const markupAmount = round2((amount * markupPercent) / 100);
    const finalAmount = round2(amount + markupAmount);

    // Start DB transaction: update Transaction status and Wallet balances atomically
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Update transaction doc (ensure it exists)
      const tx = await Transaction.findById(transactionId).session(session);
      if (!tx) {
        // create if missing (defensive)
        await Transaction.create(
          [
            {
              _id: transactionId,
              userId,
              walletId,
              type: "recurring",
              amount: finalAmount,
              currency,
              status: "processing",
              metadata: { scheduleId },
            },
          ],
          { session }
        );
      } else {
        tx.amount = finalAmount;
        tx.status = "processing";
        tx.metadata = tx.metadata || {};
        tx.metadata.scheduleId = scheduleId;
        await tx.save({ session });
      }

      // If wallets are tracked locally, credit user wallet with the finalAmount (depends on model)
      // Here we assume walletId maps to a Wallet._id
      if (walletId) {
        await Wallet.findByIdAndUpdate(
          walletId,
          { $inc: { balance: finalAmount } },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ recurringWorker DB transaction failed:", err.message || err);
      // Optionally requeue or mark failed
      // Re-throw to cause queue requeue behavior if configured
      throw err;
    }

    // 2) Charge / payout using Rapyd API (business logic: charge user / record payment)
    // For recurring, typical flow: charge user's stored payment method or debit user's ewallet
    try {
      // Example API: create a payment or debit the user's wallet
      // NOTE: adjust endpoint and payload per your Rapyd integration (customer/payment method)
      const paymentPayload = {
        amount: finalAmount,
        currency,
        customer: userId,
        wallet: walletId,
        metadata: { transactionId, scheduleId, type: "recurring_charge" },
      };

      await rapydRequest("POST", "/v1/payments", paymentPayload);
      console.log("✅ rapyd recurring payment succeeded for tx", transactionId);
    } catch (err) {
      console.error("❌ rapyd recurring payment error:", err.response?.data || err.message || err);
      // mark tx failed in DB and notify; optionally requeue with backoff
      try {
        await Transaction.findByIdAndUpdate(transactionId, { status: "failed", error: err.message });
      } catch (e) { /* ignore */ }

      notifyUser(userId, {
        type: "recurring_payment_failed",
        data: { transactionId, amount: finalAmount, currency, reason: err.message },
      });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "recurring_payment_failed", transactionId, amount: finalAmount, currency } })
      );
      return; // stop processing this job
    }

    // 3) Move markup to Swapyard Rapyd wallet (MANDATORY)
    if (markupAmount > 0) {
      try {
        // Use centralized rapydRequest to transfer from user's wallet to Swapyard
        // Adjust endpoint/path if your Rapyd wrapper expects a different route
        const transferPayload = {
          source_ewallet: walletId, // user's ewallet id or source account
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
          metadata: { transactionId, scheduleId, type: "markup_fee" },
        };

        // Use POST /v1/account/transfer or /v1/wallets/transfer depending on your Rapyd usage
        // Here we call /v1/account/transfer as used elsewhere in this project
        await rapydRequest("POST", "/v1/account/transfer", transferPayload);
        console.log(`💰 Markup transferred ${markupAmount} ${currency} to Swapyard wallet`);
      } catch (err) {
        // Very important: if the transfer fails we must record and alert
        console.error("❌ Markup transfer failed:", err.response?.data || err.message || err);

        // Persist failure info to Transaction (for admin retries)
        try {
          await Transaction.findByIdAndUpdate(transactionId, {
            $set: { markupTransferStatus: "failed", markupAmount },
          });
        } catch (e) { /* ignore */ }

        // Notify admin/system (you can hook into email/SMS or alerting)
        notifyUser(userId, {
          type: "recurring_payment_markup_transfer_failed",
          data: { transactionId, markupAmount, currency },
        });
        await redisClient.publish(
          "notifications",
          JSON.stringify({ userId, data: { type: "recurring_payment_markup_transfer_failed", transactionId, markupAmount, currency } })
        );

        // Do NOT rollback user transaction because user was charged; let admin retry markup transfer later.
      }
    }

    // 4) Finalize transaction status (completed) and notify user
    try {
      await Transaction.findByIdAndUpdate(transactionId, {
        status: "completed",
        amount: finalAmount,
        markupAmount,
        completedAt: new Date(),
      });
    } catch (err) {
      console.warn("⚠️ Could not update transaction final status:", err.message || err);
    }

    notifyUser(userId, {
      type: "recurring_payment_complete",
      data: { transactionId, amount: finalAmount, currency, markupAmount },
    });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "recurring_payment_complete", transactionId, amount: finalAmount, currency, markupAmount } })
    );

    // 5) Optionally update RecurringPayment.nextRun if immediate trigger (scheduler usually advances it)
    try {
      if (scheduleId) {
        const sched = await RecurringPayment.findById(scheduleId);
        if (sched && sched.active) {
          // ensure nextRun is in future; scheduler is mainly responsible, but we can bump a small safety window
          if (!sched.nextRun || new Date(sched.nextRun) <= new Date()) {
            // safety: increment according to frequency
            const next = new Date();
            if (sched.frequency === "daily") next.setDate(next.getDate() + 1);
            else if (sched.frequency === "weekly") next.setDate(next.getDate() + 7);
            else if (sched.frequency === "monthly") next.setMonth(next.getMonth() + 1);
            sched.nextRun = next;
            await sched.save();
          }
        }
      }
    } catch (err) {
      console.warn("⚠️ Could not advance recurring schedule nextRun:", err.message || err);
    }

    console.log("✅ recurringWorker finished job", transactionId);
  });
})();
