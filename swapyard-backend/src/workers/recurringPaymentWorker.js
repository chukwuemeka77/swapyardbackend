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

    // 1️⃣ Get markup
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

    // 3️⃣ Move markup to Swapyard wallet via Rapyd
    try {
      await rapydRequest("post", "/v1/payouts", {
        beneficiary: process.env.SWAPYARD_RAPYD_WALLET_ID,
        amount: markupAmount,
        currency,
        description: `Recurring payment markup from user ${userId}`,
      });
      console.log(`💰 Markup of ${markupAmount} ${currency} moved to Swapyard wallet`);
    } catch (err) {
      console.error("❌ Failed to move markup:", err.message || err);
    }

    // 4️⃣ Notify user via SSE
    notifyUser(userId, { type: "recurring_payment_complete", data: { amount: finalAmount, currency } });

    // 5️⃣ Publish to Redis Pub/Sub for multi-instance updates
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "recurring_payment_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Recurring payment completed for user ${userId}`);
  });
})();
