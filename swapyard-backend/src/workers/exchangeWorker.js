// src/workers/exchangeWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/MarkupSetting");
const ExchangeProfit = require("../models/ExchangeProfit");
const Wallet = require("../models/Wallet");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, pair, amount, baseRate } = job;
    console.log("💱 Processing exchange:", job);

    try {
      // 1️⃣ Get markup percentage
      const markup = await MarkupSetting.findOne({ type: "exchange" });
      const markupPercent = markup ? markup.percentage : 0;

      // 2️⃣ Calculate effective rate and converted amount
      const effectiveRate = baseRate * (1 - markupPercent / 100);
      const convertedAmount = amount * effectiveRate;
      const profitEarned = amount * baseRate - convertedAmount;

      // 3️⃣ Update user's wallet (assumes target currency wallet exists)
      await Wallet.findOneAndUpdate(
        { userId, currency: pair.split("/")[1] },
        { $inc: { balance: convertedAmount } }
      );

      // 4️⃣ Record exchange profit
      await ExchangeProfit.create({
        userId,
        pair,
        amount,
        convertedAmount,
        baseRate,
        effectiveRate,
        markupPercent,
        profitEarned,
        transactionId: job.transactionId || null,
      });

      // 5️⃣ Notify via SSE
      notifyUser(userId, {
        type: "exchange_complete",
        data: { pair, amount, convertedAmount, effectiveRate, markupPercent },
      });

      // 6️⃣ Redis Pub/Sub for other instances
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId,
          data: { type: "exchange_complete", pair, amount, convertedAmount, effectiveRate, markupPercent },
        })
      );

      console.log(`✅ Exchange completed for ${userId}`);
    } catch (err) {
      console.error("❌ Exchange failed:", err.message || err);
    }
  });
})();
