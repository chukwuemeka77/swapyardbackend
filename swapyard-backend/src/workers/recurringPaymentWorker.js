// src/workers/recurringPaymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId, scheduleId } = job;
    console.log("💳 Processing recurring payment:", transactionId);

    // Get markup
    const markup = await MarkupSetting.findOne({ type: "recurring" });
    const markupPercent = markup ? markup.percentage : 0;
    const finalAmount = amount * (1 + markupPercent / 100);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Debit from user wallet
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -finalAmount } }, { session });

      // Record transaction
      await Transaction.create([{ 
        _id: transactionId,
        userId,
        walletId,
        type: "recurring",
        amount: finalAmount,
        currency,
        status: "completed",
        scheduleId
      }], { session });

      await session.commitTransaction();
      session.endSession();

      // Optionally move markup to Swapyard Rapyd wallet via rapydRequest
      // await rapydRequest("POST", "/v1/wallets/transfer", { ... });

      // Notify user
      notifyUser(userId, { type: "recurring_payment_complete", data: { amount: finalAmount, currency } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "recurring_payment_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Recurring payment completed for ${userId}`);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ Recurring payment failed:", err.message);
      throw err;
    }
  });
})();
