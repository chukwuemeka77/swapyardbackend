// src/workers/recurringPaymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { userId, amount, currency, walletId, transactionId, scheduleId } = job;
    console.log("💳 Processing recurring payment:", transactionId);

    // 1️⃣ Get markup for recurring payments
    const markup = await MarkupSetting.findOne({ type: "recurring" });
    const markupPercent = markup ? markup.percentage : 0;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount + markupAmount;

    // 2️⃣ Update transaction in DB
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Transaction.findByIdAndUpdate(
        transactionId,
        { status: "completed", amount: finalAmount },
        { session }
      );
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    // 3️⃣ Transfer markup to Swapyard wallet via Rapyd
    try {
      await rapydRequest("POST", "/v1/wallets/transfer", {
        source_wallet: walletId, // User's wallet
        destination_wallet: process.env.SWAPYARD_WALLET_ID, // Swapyard's wallet
        amount: markupAmount,
        currency,
        metadata: { transactionId, scheduleId }
      });
      console.log(`💰 Markup of ${markupAmount} ${currency} moved to Swapyard wallet`);
    } catch (err) {
      console.error("❌ Failed to move markup to Swapyard wallet:", err.message || err);
      // Optionally, log for retry or alert admin
    }

    // 4️⃣ Notify user via SSE
    notifyUser(userId, {
      type: "recurring_payment_complete",
      data: { amount: finalAmount, currency, markup: markupAmount }
    });

    // 5️⃣ Publish to Redis Pub/Sub for cross-instance notification
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: { type: "recurring_payment_complete", amount: finalAmount, currency, markup: markupAmount }
      })
    );

    console.log(`✅ Recurring payment completed for user ${userId} (total charged: ${finalAmount} ${currency})`);
  });
})();
