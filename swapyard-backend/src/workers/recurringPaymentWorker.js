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

const GLOBAL_MARKUP = (() => { const v = process.env.MARKUP_PERCENT; return v ? parseFloat(v) : null; })();
const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;
if (!SWAPYARD_WALLET_ID) console.warn("⚠️ SWAPYARD_WALLET_ID not set; markup transfers will fail.");

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId, scheduleId } = job;
    console.log("🔁 recurringWorker: starting", { transactionId, scheduleId });

    let markupPercent = GLOBAL_MARKUP;
    try { if (markupPercent === null) { const db = await MarkupSetting.findOne({ type: "recurring" }); markupPercent = db ? db.percentage : 0; } } catch (err) { console.warn("⚠️ markup load fail:", err.message || err); markupPercent = markupPercent || 0; }
    markupPercent = Number(markupPercent || 0);

    const markupAmount = round2((amount * markupPercent) / 100);
    const finalAmount = round2(amount + markupAmount);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let tx = null;
      if (transactionId) tx = await Transaction.findById(transactionId).session(session);
      if (!tx) {
        tx = (await Transaction.create([{
          _id: transactionId,
          userId,
          walletId,
          type: "recurring",
          amount: finalAmount,
          currency,
          status: "processing",
          metadata: { scheduleId },
        }], { session }))[0];
      } else {
        tx.amount = finalAmount; tx.status = "processing"; tx.metadata = tx.metadata || {}; tx.metadata.scheduleId = scheduleId; await tx.save({ session });
      }
      if (walletId) await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: finalAmount } }, { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction(); session.endSession();
      console.error("❌ recurring DB error:", err.message || err);
      throw err;
    }

    try {
      await rapydRequest("POST", "/v1/payments", { amount: finalAmount, currency, customer: userId, wallet: walletId, metadata: { transactionId, scheduleId } });
      console.log("✅ rapyd recurring payment success", transactionId);
    } catch (err) {
      console.error("❌ rapyd recurring payment failed:", err.response?.data || err.message || err);
      try { await Transaction.findByIdAndUpdate(transactionId, { status: "failed", error: err.message }); } catch (e) {}
      notifyUser(userId, { type: "recurring_failed", data: { transactionId, amount: finalAmount } });
      await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "recurring_failed", transactionId } }));
      return;
    }

    // mandatory markup transfer
    if (markupAmount > 0) {
      try {
        await rapydRequest("POST", "/v1/account/transfer", { source_ewallet: walletId, destination_ewallet: SWAPYARD_WALLET_ID, amount: markupAmount, currency, metadata: { transactionId, scheduleId, type: "markup_fee" } });
        console.log(`💰 recurring markup transferred ${markupAmount} ${currency}`);
      } catch (err) {
        console.error("❌ recurring markup transfer failed:", err.response?.data || err.message || err);
        try { await Transaction.findByIdAndUpdate(transactionId, { markupAmount, markupTransferStatus: "failed" }); } catch (e) {}
        notifyUser(userId, { type: "recurring_markup_failed", data: { transactionId, markupAmount } });
        await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "recurring_markup_failed", transactionId, markupAmount } }));
      }
    }

    try {
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount, markupAmount, completedAt: new Date() });
    } catch (err) { console.warn("⚠️ recurring finalize failed:", err.message || err); }

    notifyUser(userId, { type: "recurring_complete", data: { transactionId, amount: finalAmount, markupAmount } });
    await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "recurring_complete", transactionId, amount: finalAmount } }));
    console.log("✅ recurringWorker finished", transactionId);
  });
})();
