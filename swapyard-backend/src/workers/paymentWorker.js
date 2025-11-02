// src/workers/paymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/MarkupSetting");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, amount, currency } = job;
    console.log("💳 Processing payment:", job);

    try {
      // 1️⃣ Get markup for payments
      const markup = await MarkupSetting.findOne({ type: "payment" });
      const markupPercent = markup ? markup.percentage : 0;
      const effectiveAmount = amount - (amount * markupPercent) / 100;

      // 2️⃣ Credit user wallet
      await Wallet.findOneAndUpdate(
        { userId, currency },
        { $inc: { balance: effectiveAmount } },
        { upsert: true }
      );

      // 3️⃣ Record transaction
      await Transaction.create({
        userId,
        type: "payment",
        amount,
        effectiveAmount,
        currency,
        status: "completed",
        metadata: { markupPercent },
      });

      // 4️⃣ Notify via SSE
      notifyUser(userId, {
        type: "payment_complete",
        data: { amount, effectiveAmount, currency, markupPercent },
      });

      // 5️⃣ Redis Pub/Sub for other instances
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId,
          data: { type: "payment_complete", amount, effectiveAmount, currency, markupPercent },
        })
      );

      console.log(`✅ Payment processed for ${userId}`);
    } catch (err) {
      console.error("❌ Payment processing failed:", err.message || err);
    }
  });
})();
