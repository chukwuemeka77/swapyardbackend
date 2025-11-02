const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const ExchangeProfit = require("../models/ExchangeProfit");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, pair, fromAmount, baseRate, walletId, transactionId } = job;
    console.log("💱 Processing exchange:", transactionId);

    // 1️⃣ Get markup
    const markup = await MarkupSetting.findOne({ type: "exchange" });
    const markupPercent = markup ? markup.percentage : 0;

    const effectiveRate = baseRate * (1 - markupPercent / 100);
    const convertedAmount = fromAmount * effectiveRate;
    const profitEarned = fromAmount * (baseRate - effectiveRate);

    // 2️⃣ Save exchange profit
    await ExchangeProfit.create({
      userId,
      pair,
      amount: fromAmount,
      convertedAmount,
      baseRate,
      effectiveRate,
      markupPercent,
      profitEarned,
      transactionId,
    });

    // 3️⃣ Notify user
    notifyUser(userId, { type: "exchange_complete", data: { pair, convertedAmount, profitEarned } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "exchange_complete", pair, convertedAmount, profitEarned } })
    );

    // 4️⃣ Move profit to Swapyard wallet
    if (profitEarned > 0) {
      await rapydRequest("post", `/v1/account/transfer`, {
        source_ewallet: walletId,
        destination_ewallet: process.env.SWAPYARD_WALLET_ID,
        amount: profitEarned.toFixed(2),
        currency: pair.split("/")[1],
        metadata: { transactionId, type: "markup_fee", userId },
      });
    }

    console.log(`✅ Exchange completed for ${userId} (profit: ${profitEarned})`);
  });
})();
