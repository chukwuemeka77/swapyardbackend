// src/workers/withdrawalWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const GLOBAL_MARKUP = (() => { const v = process.env.MARKUP_PERCENT; return v ? parseFloat(v) : null; })();
const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;
if (!SWAPYARD_WALLET_ID) console.warn("⚠️ SWAPYARD_WALLET_ID not set; markup transfers will fail.");

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccountId, walletId } = job;
    console.log("🏦 withdrawalWorker: starting", { transactionId, userId, amount, currency });

    // markup percentage
    let markupPercent = GLOBAL_MARKUP;
    try {
      if (markupPercent === null) {
        const db = await MarkupSetting.findOne({ type: "withdrawal" });
        markupPercent = db ? db.percentage : 0;
      }
    } catch (err) {
      console.warn("⚠️ withdrawalWorker markup load failed:", err.message || err);
      markupPercent = markupPercent || 0;
    }
    markupPercent = Number(markupPercent || 0);

    const markupAmount = round2((amount * markupPercent) / 100);
    const finalAmount = round2(amount - markupAmount); // user receives less

    // DB transaction: deduct from wallet and mark processing
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (walletId) {
        await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
      } else {
        await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: -amount } }, { session });
      }

      let tx = null;
      if (transactionId) tx = await Transaction.findById(transactionId).session(session);
      if (!tx) {
        tx = (await Transaction.create([{
          _id: transactionId,
          userId,
          walletId,
          type: "withdrawal",
          amount: finalAmount,
          currency,
          status: "processing",
          metadata: { bankAccountId },
        }], { session }))[0];
      } else {
        tx.amount = finalAmount;
        tx.status = "processing";
        tx.metadata = tx.metadata || {};
        tx.metadata.bankAccountId = bankAccountId;
        await tx.save({ session });
      }

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ withdrawalWorker DB error:", err.message || err);
      throw err;
    }

    // Rapyd payout to bank
    try {
      const payoutPayload = {
        amount: finalAmount,
        currency,
        bank_account_id: bankAccountId,
        metadata: { transactionId },
      };
      await rapydRequest("POST", "/v1/payouts", payoutPayload);
      console.log("✅ rapyd payout success for tx", transactionId);
    } catch (err) {
      console.error("❌ rapyd payout error:", err.response?.data || err.message || err);
      await Transaction.findByIdAndUpdate(transactionId, { status: "failed", error: err.message });
      notifyUser(userId, { type: "withdrawal_failed", data: { transactionId, amount: finalAmount, currency } });
      await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "withdrawal_failed", transactionId } }));
      return;
    }

    // mandatory transfer of markup to Swapyard
    if (markupAmount > 0) {
      try {
        const transferPayload = {
          source_ewallet: walletId || bankAccountId,
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
          metadata: { transactionId, type: "markup_fee" },
        };
        await rapydRequest("POST", "/v1/account/transfer", transferPayload);
        console.log(`💰 withdrawalWorker: markup ${markupAmount} ${currency} moved to Swapyard`);
      } catch (err) {
        console.error("❌ withdrawal markup transfer failed:", err.response?.data || err.message || err);
        try { await Transaction.findByIdAndUpdate(transactionId, { markupAmount, markupTransferStatus: "failed" }); } catch (e) {}
        notifyUser(userId, { type: "withdrawal_markup_failed", data: { transactionId, markupAmount, currency } });
        await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "withdrawal_markup_failed", transactionId, markupAmount } }));
      }
    }

    // finalize
    try {
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount, markupAmount, completedAt: new Date() });
    } catch (err) { console.warn("⚠️ withdrawal final update failed:", err.message || err); }

    notifyUser(userId, { type: "withdrawal_complete", data: { transactionId, amount: finalAmount, currency, markupAmount } });
    await redisClient.publish("notifications", JSON.stringify({ userId, data: { type: "withdrawal_complete", transactionId, amount: finalAmount } }));
    console.log("✅ withdrawalWorker finished", transactionId);
  });
})();
