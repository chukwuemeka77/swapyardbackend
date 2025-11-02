// src/workers/internationalDepositWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("internationalDepositQueue", async (job) => {
    const { userId, amount, currency, walletId, transactionId, bankAccountId } = job;
    console.log("🌎 Processing international deposit:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "deposit" });
    const markupPercent = markup ? markup.percentage : 0;
    const finalAmount = amount * (1 + markupPercent / 100);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: finalAmount } }, { session });
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    try {
      await rapydRequest("POST", "/v1/account/deposit", {
        amount: finalAmount,
        currency,
        bank_account: bankAccountId,
        customer: userId,
      });
    } catch (err) {
      console.error("❌ Rapyd international deposit failed:", err.message);
    }

    notifyUser(userId, { type: "international_deposit_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "international_deposit_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ International deposit completed for ${userId} (final: ${finalAmount})`);
  });
})();
