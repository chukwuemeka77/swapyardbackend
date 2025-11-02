const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSetting");
const ExchangeProfit = require("../models/ExchangeProfit");
const Wallet = require("../models/Wallet");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, pair, amount, baseRate } = job;
    console.log("🔄 Processing FX exchange:", job);

    // ✅ Fetch exchange markup
    const markup = await MarkupSetting.findOne({ type: "exchange" });
    const markupPercent = markup ? markup.percentage : 0;

    const effectiveRate = baseRate * (1 - markupPercent / 100);
    const convertedAmount = amount * effectiveRate;
    const profitEarned = amount * (baseRate - effectiveRate);

    // 💾 Update user wallet
    await Wallet.findOneAndUpdate(
      { userId, currency: pair.split("/")[1] },
      { $inc: { balance: convertedAmount } },
      { upsert: true }
    );

    // 💾 Log exchange profit
    await ExchangeProfit.create({
      userId,
      pair,
      amount,
      convertedAmount,
      baseRate,
      effectiveRate,
      markupPercent,
      profitEarned,
      transactionId: job.transactionId,
    });

    // Notify user
    notifyUser(userId, {
      type: "exchange_complete",
      data: { pair, convertedAmount, profitEarned, markupPercent },
    });

    // Redis Pub/Sub
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: { type: "exchange_complete", pair, convertedAmount, profitEarned, markupPercent },
      })
    );

    console.log(`✅ FX completed for ${userId} | Profit: ${profitEarned}`);
  });
})();
