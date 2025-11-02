// src/workers/internationalWithdrawalWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("internationalWithdrawalQueue", async (job) => {
    const { userId, amount, currency, walletId, transactionId, bankAccountId } = job;
    console.log("🌎 Processing international withdrawal:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "withdrawal" });
    const markupPercent = markup ? markup.percentage : 0;
    const finalAmount = amount * (1 - markupPercent / 100);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    try {
      await rapydRequest("POST", "/v1/account/withdrawal", {
        amount: finalAmount,
        currency,
        bank_account: bankAccountId,
        customer: userId,
      });
    } catch (err) {
      console.error("❌ Rapyd international withdrawal failed:", err.message);
    }

    notifyUser(userId, { type: "international_withdrawal_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "international_withdrawal_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ International withdrawal completed for ${userId} (final: ${finalAmount})`);
  });
})();
