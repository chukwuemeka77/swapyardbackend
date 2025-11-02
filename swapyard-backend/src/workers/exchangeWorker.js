// src/workers/exchangeWorker.js
const { consumeQueue } = require("../services/rabbitmqService"); // adapt if your service exposes a different name
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { getRateAndMarkup, applyMarkup } = require("../utils/markupCalculator");
const ExchangeProfit = require("../models/ExchangeProfit");
const Wallet = require("../models/Wallet"); // ensure Wallet model exists
const Transaction = require("../models/Transaction"); // optional, if you create transactions

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, fromCurrency, toCurrency, amount, transactionId } = job;
    const pair = `${fromCurrency}_${toCurrency}`;

    console.log("💱 Processing exchange job:", { pair, amount, userId, transactionId });

    try {
      // 1) get base rate & markup
      const { baseRate, markupPercent, source } = await getRateAndMarkup(pair);

      if (!baseRate) {
        // If no baseRate in DB, either fetch from external API or fail.
        // Here we fail fast - you may replace with an API call to fetch live rates.
        throw new Error(`No base rate available for pair ${pair}`);
      }

      // 2) apply markup
      const { effectiveRate, profitPerUnit } = applyMarkup(baseRate, markupPercent);
      const convertedAmount = amount * effectiveRate;
      const profitEarned = profitPerUnit * amount;

      // 3) Update wallets atomically if you want (simple example)
      // Debit from source wallet (if present) and credit to destination wallet.
      // Implement based on your Wallet schema. Example:
      if (Wallet) {
        // debit fromCurrency wallet
        await Wallet.findOneAndUpdate(
          { userId, currency: fromCurrency },
          { $inc: { balance: -amount } },
          { upsert: false }
        );

        // credit toCurrency wallet
        await Wallet.findOneAndUpdate(
          { userId, currency: toCurrency },
          { $inc: { balance: convertedAmount } },
          { upsert: true }
        );
      }

      // 4) record profit
      await ExchangeProfit.create({
        userId,
        pair,
        amount,
        convertedAmount,
        baseRate,
        effectiveRate,
        markupPercent,
        profitEarned,
        transactionId: transactionId || null,
      });

      // 5) optionally update transaction record
      if (Transaction && transactionId) {
        await Transaction.findByIdAndUpdate(transactionId, {
          status: "completed",
          metadata: {
            baseRate,
            effectiveRate,
            markupPercent,
            convertedAmount,
            profitEarned,
          },
        });
      }

      // 6) notify user via SSE
      const payload = {
        type: "exchange_complete",
        data: {
          fromCurrency,
          toCurrency,
          amount,
          convertedAmount,
          baseRate,
          effectiveRate,
          markupPercent,
          profitEarned,
        },
      };
      notifyUser(userId, payload);

      // 7) publish via Redis for other instances
      await redisClient.publish("notifications", JSON.stringify({ userId, data: payload }));

      console.log("✅ Exchange completed:", { pair, amount, convertedAmount, profitEarned });
    } catch (err) {
      console.error("❌ Exchange worker error:", err.message || err);
      throw err; // let RabbitMQ requeue/nack handling manage retries if configured
    }
  });
})();
