// src/workers/withdrawalWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { payoutToBank } = require("../services/bankPayoutService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId, bankAccountId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    try {
      // ✅ Fetch markup for withdrawal
      const markup = await MarkupSetting.findOne({ type: "withdrawal" });
      const markupPercent = markup ? markup.percentage : 0;
      const finalAmount = amount * (1 - markupPercent / 100); // user gets less

      // ✅ Start MongoDB transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Deduct wallet balance
        await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });

        // Update Transaction
        await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });

        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }

      // ✅ If bankAccountId exists, payout using Rapyd
      let rapydResponse = null;
      if (bankAccountId) {
        rapydResponse = await payoutToBank(bankAccountId, finalAmount, currency);
        console.log("💳 Rapyd payout response:", rapydResponse);
      }

      // ✅ Notify user
      notifyUser(userId, { type: "withdrawal_complete", data: { amount: finalAmount, currency } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "withdrawal_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Withdrawal completed for ${userId} (final: ${finalAmount})`);
    } catch (err) {
      console.error("❌ Withdrawal failed:", err.message);
      throw err;
    }
  });
})();
