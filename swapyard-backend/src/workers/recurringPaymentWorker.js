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

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const {
      userId,
      walletId,
      amount,
      currency,
      transactionId,
      scheduleId,
      retries = 0,
    } = job;

    console.log("🔁 recurringWorker: processing", { transactionId, scheduleId, userId });

    // 1) Determine markup percent (env override -> DB)
    let markupPercent = GLOBAL_MARKUP;
    try {
      if (markupPercent === null) {
        const db = await MarkupSetting.findOne({ type: "recurring" });
        markupPercent = db ? db.percentage : 0;
      }
    } catch (err) {
      console.warn("⚠️ Could not load markupSetting, defaulting to 0:", err.message || err);
      markupPercent = markupPercent || 0;
    }
    markupPercent = Number(markupPercent || 0);

    const markupAmount = round2((amount * markupPercent) / 100);
    const finalAmount = round2(amount + markupAmount);

    // 2) DB transaction: ensure transaction exists and credit user wallet
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let tx = null;
      if (transactionId) {
        tx = await Transaction.findById(transactionId).session(session);
      }
      if (!tx) {
        tx = await Transaction.create(
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
        tx = tx[0];
      } else {
        tx.amount = finalAmount;
        tx.status = "processing";
        tx.metadata = tx.metadata || {};
        tx.metadata.scheduleId = scheduleId;
        await tx.save({ session });
      }

      if (walletId) {
        await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: finalAmount } }, { session });
      }

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ recurringWorker DB error:", err.message || err);
      // re-throw to let queue system handle retry policies
      throw err;
    }

    // 3) Execute payment via Rapyd (charge or record payment)
    try {
      const paymentPayload = {
        amount: finalAmount,
        currency,
        customer: userId,
        wallet: walletId,
        metadata: { transactionId, scheduleId, type: "recurring_charge" },
      };
      await rapydRequest("POST", "/v1/payments", paymentPayload);
      console.log("✅ Rapyd payment success for tx", transactionId);
    } catch (err) {
      console.error("❌ Rapyd recurring payment failed:", err.response?.data || err.message || err);
      // mark transaction failed and notify
      try {
        await Transaction.findByIdAndUpdate(transactionId, { status: "failed", error: err.message });
      } catch (e) {}
      notifyUser(userId, {
        type: "recurring_payment_failed",
        data: { transactionId, amount: finalAmount, currency, reason: err.message },
      });
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId,
          data: { type: "recurring_payment_failed", transactionId, amount: finalAmount, currency },
        })
      );
      return;
    }

    // 4) MANDATORY: transfer markup to Swapyard Rapyd wallet
    if (markupAmount > 0) {
      try {
        const transferPayload = {
          source_ewallet: walletId,
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
          metadata: { transactionId, scheduleId, type: "markup_fee" },
        };
        await rapydRequest("POST", "/v1/account/transfer", transferPayload);
        console.log(`💰 Markup ${markupAmount} ${currency} transferred to Swapyard wallet`);
      } catch (err) {
        console.error("❌ Markup transfer failed:", err.response?.data || err.message || err);
        // record markup transfer failure for admin retry; do not rollback user charge
        try {
          await Transaction.findByIdAndUpdate(transactionId, {
            $set: { markupAmount, markupTransferStatus: "failed" },
          });
        } catch (e) {}
        notifyUser(userId, {
          type: "recurring_payment_markup_failed",
          data: { transactionId, markupAmount, currency },
        });
        await redisClient.publish(
          "notifications",
          JSON.stringify({
            userId,
            data: { type: "recurring_payment_markup_failed", transactionId, markupAmount, currency },
          })
        );
        // keep going — admin can retry markup transfer via admin route
      }
    }

    // 5) Finalize transaction and notify user
    try {
      await Transaction.findByIdAndUpdate(transactionId, {
        status: "completed",
        amount: finalAmount,
        markupAmount,
        completedAt: new Date(),
      });
    } catch (err) {
      console.warn("⚠️ Could not finalize transaction:", err.message || err);
    }

    notifyUser(userId, {
      type: "recurring_payment_complete",
      data: { transactionId, amount: finalAmount, currency, markupAmount },
    });
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: { type: "recurring_payment_complete", transactionId, amount: finalAmount, currency, markupAmount },
      })
    );

    // 6) Bump schedule nextRun if scheduleId provided (scheduler typically handles this)
    try {
      if (scheduleId) {
        const sched = await RecurringPayment.findById(scheduleId);
        if (sched && sched.active && (!sched.nextRun || new Date(sched.nextRun) <= new Date())) {
          const next = new Date();
          if (sched.frequency === "daily") next.setDate(next.getDate() + 1);
          else if (sched.frequency === "weekly") next.setDate(next.getDate() + 7);
          else if (sched.frequency === "monthly") next.setMonth(next.getMonth() + 1);
          sched.nextRun = next;
          await sched.save();
        }
      }
    } catch (err) {
      console.warn("⚠️ Could not update schedule nextRun:", err.message || err);
    }

    console.log("✅ recurringWorker finished", transactionId);
  });
})();
