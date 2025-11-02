const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const ExchangeProfit = require("../models/ExchangeProfit");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, pair, amount, baseRate } = job;

    // apply markup
    const markup = await MarkupSetting.findOne({ type: "exchange" });
    const effectiveRate = markup ? baseRate * (1 - markup.percentage / 100) : baseRate;
    const convertedAmount = amount * effectiveRate;
    const profitEarned = convertedAmount - amount * baseRate;

    // save record
    const profitRecord = await ExchangeProfit.create({
      userId,
      pair,
      amount,
      convertedAmount,
      baseRate,
      effectiveRate,
      markupPercent: markup ? markup.percentage : 0,
      profitEarned,
      transactionId: job.transactionId || null,
    });

    // notify frontend via SSE
    notifyUser(userId, { type: "exchange_complete", data: profitRecord });

    // Redis Pub/Sub cross-instance
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "exchange_complete", profitRecord } })
    );

    console.log(`✅ Exchange completed for ${userId} (${pair})`);
  });
})();
