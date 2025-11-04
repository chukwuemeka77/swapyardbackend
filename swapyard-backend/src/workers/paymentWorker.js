// src/workers/paymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const GLOBAL_MARKUP = (() => {
  const v = process.env.MARKUP_PERCENT;
  return v ? parseFloat(v) : null;
})();

const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;
if (!SWAPYARD_WALLET_ID) console.warn("⚠️ SWAPYARD_WALLET_ID not set; markup transfers will fail.");

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, amount, currency, transactionId, paymentSource } = job;
    console.log("💳 paymentWorker: starting", { transactionId, userId, amount, currency });

    // get markup percent
    let markupPercent = GLOBAL_MARKUP;
    try {
      if (markupPercent === null) {
        const db = await MarkupSetting.findOne({ type: "payment" });
        markupPercent = db ? db.percentage : 0;
      }
    } catch (err) {
      console.warn("⚠️ paymentWorker markup load failed, defaulting to 0:", err.message || err);
      markupPercent = markupPercent || 0;
    }
    markupPercent = Number(markupPercent || 0);

    const markupAmount = round2((amount * markupPercent) / 100);
    const finalAmount = round2(amount + markupAmount);

    // DB transaction: mark transaction processing
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let tx = null;
      if (transactionId) tx = await Transaction.findById(transactionId).session(session);
      if (!tx) {
        tx = (await Transaction.create([{
          _id: transactionId,
          userId,
          type: "payment",
          amount: finalAmount,
          currency,
          status: "processing",
          metadata: { paymentSource },
        }], { session }))[0];
      } else {
        tx.amount = finalAmount;
        tx.status = "processing";
        tx.metadata = tx.metadata || {};
        tx.metadata.paymentSource = paymentSource;
        await tx.save({ session });
      }
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ paymentWorker DB error:", err.message || err);
      throw err;
    }

    // call Rapyd to capture/charge using centralized rapydRequest
    try {
      const payload = {
        amount: finalAmount,
        currency,
        customer: userId,
        source: paymentSource, // adjust to your Rapyd flow
        metadata: { transactionId, type: "payment" },
      };
      await rapydRequest("POST", "/v1/payments", payload);
      console.log("✅ rapyd payment success for tx", transactionId);
    } catch (err) {
      console.error("❌ rapyd payment error:", err.response?.data || err.message || err);
      await Transaction.findByIdAndUpdate(transactionId, { status: "failed", error: err.message });
      notifyUser(userId, { type: "payment_failed", data: { transactionId, amount: finalAmount, currency } });
      await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "payment_failed", transactionId, amount: finalAmount } }));
      return;
    }

    // mandatory: transfer markup to Swapyard wallet
    if (markupAmount > 0) {
      try {
        const transferPayload = {
          source_ewallet: paymentSource, // if paymentSource maps to rapyd ewallet; else map appropriately
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
          metadata: { transactionId, type: "markup_fee" },
        };
        await rapydRequest("POST", "/v1/account/transfer", transferPayload);
        console.log(`💰 paymentWorker: markup ${markupAmount} ${currency} transferred to Swapyard`);
      } catch (err) {
        console.error("❌ payment markup transfer failed:", err.response?.data || err.message || err);
        // record failed markup transfer on transaction for admin retry
        try {
          await Transaction.findByIdAndUpdate(transactionId, { markupAmount, markupTransferStatus: "failed" });
        } catch (e) {}
        notifyUser(userId, { type: "payment_markup_failed", data: { transactionId, markupAmount, currency } });
        await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "payment_markup_failed", transactionId, markupAmount } }));
        // continue — user was charged; admin can retry markup transfer
      }
    }

    // finalize tx
    try {
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount, markupAmount, completedAt: new Date() });
    } catch (err) {
      console.warn("⚠️ paymentWorker final update failed:", err.message || err);
    }

    notifyUser(userId, { type: "payment_complete", data: { transactionId, amount: finalAmount, currency, markupAmount } });
    await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "payment_complete", transactionId, amount: finalAmount } }));
    console.log("✅ paymentWorker finished", transactionId);
  });
})();
