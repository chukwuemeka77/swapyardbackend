const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const ExchangeProfit = require("../models/ExchangeProfit");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, pair, amount, baseRate, transactionId } = job;
    console.log("🔄 Processing exchange:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "exchange" });
    const markupPercent = markup ? markup.percentage : 0;
    const effectiveRate = baseRate * (1 - markupPercent / 100);
    const convertedAmount = amount * effectiveRate;
    const profitEarned = amount * (baseRate - effectiveRate);

    await ExchangeProfit.create({
      userId,
      pair,
      amount,
      convertedAmount,
      baseRate,
      effectiveRate,
      markupPercent,
      profitEarned,
      transactionId,
    });

    // Notify user
    notifyUser(userId, { type: "exchange_complete", data: { pair, convertedAmount } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "exchange_complete", pair, convertedAmount } })
    );

    console.log(`✅ Exchange completed for ${userId}: ${amount} → ${convertedAmount}`);
  });
})();
