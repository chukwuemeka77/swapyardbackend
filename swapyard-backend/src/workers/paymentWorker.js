// src/workers/paymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const { set, get } = require("../utils/cache"); // <<--- this was missing

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, amount, currency, transactionId } = job;
    console.log("💳 Processing payment:", transactionId);

    try {
      // --- Get markup from cache or DB ---
      let markupPercent = get("paymentMarkup");
      if (markupPercent === null) {
        const markup = await MarkupSetting.findOne({ type: "payment" });
        markupPercent = markup ? markup.percentage : 0;
        set("paymentMarkup", markupPercent, 300); // cache for 5 min
      }

      const finalAmount = amount * (1 + markupPercent / 100);

      // --- MongoDB transaction ---
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

      // --- Notify user ---
      notifyUser(userId, { type: "payment_complete", data: { amount: finalAmount, currency } });

      // --- Publish to Redis Pub/Sub ---
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "payment_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Payment completed for ${userId} (final amount: ${finalAmount})`);
    } catch (err) {
      console.error("❌ Payment processing failed:", err.message);
      throw err; // let RabbitMQ retry or dead-letter
    }
  });
})();
