// src/workers/exchangeWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const ExchangeProfit = require("../models/ExchangeProfit");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, amount, fromCurrency, toCurrency, transactionId, baseRate } = job;
    console.log("💱 Processing exchange:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "exchange" });
    const markupPercent = markup ? markup.percentage : 0;
    const effectiveRate = baseRate * (1 - markupPercent / 100);
    const convertedAmount = amount * effectiveRate;
    const profitEarned = amount * baseRate - convertedAmount;

    // Store exchange profit
    await ExchangeProfit.create({
      userId,
      pair: `${fromCurrency}_${toCurrency}`,
      amount,
      convertedAmount,
      baseRate,
      effectiveRate,
      markupPercent,
      profitEarned,
      transactionId,
    });

    // Move markup to Swapyard wallet
    const swapyardWallet = await Wallet.findOne({ isSwapyard: true });
    if (profitEarned > 0 && swapyardWallet?.rapydWalletId) {
      await rapydRequest("POST", `/wallets/${swapyardWallet.rapydWalletId}/transactions`, {
        amount: profitEarned,
        currency: fromCurrency,
        type: "credit",
        description: `Exchange markup from user ${userId}`,
      });
    }

    notifyUser(userId, { type: "exchange_complete", data: { fromCurrency, toCurrency, convertedAmount } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "exchange_complete", fromCurrency, toCurrency, convertedAmount } })
    );

    console.log(`✅ Exchange completed for ${userId} (converted: ${convertedAmount})`);
  });
})();
