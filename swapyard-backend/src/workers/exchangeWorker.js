// src/workers/exchangeWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const ExchangeProfit = require("../models/ExchangeProfit");
const Wallet = require("../models/Wallet");
const { set, get } = require("../utils/cache");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, fromCurrency, toCurrency, amount, walletId } = job;
    console.log("💱 Processing exchange for user:", userId);

    try {
      // --- Get markup ---
      let markupPercent = get("exchangeMarkup");
      if (markupPercent === null) {
        const markup = await MarkupSetting.findOne({ type: "exchange" });
        markupPercent = markup ? markup.percentage : 0;
        set("exchangeMarkup", markupPercent, 300);
      }

      // --- Calculate conversion ---
      const baseRate = await getBaseRate(fromCurrency, toCurrency); // implement FX API call
      const effectiveRate = baseRate * (1 - markupPercent / 100);
      const convertedAmount = amount * effectiveRate;
      const profit = amount * (baseRate - effectiveRate);

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: convertedAmount } }, { session });
        const exchangeDoc = new ExchangeProfit({
          userId,
          pair: `${fromCurrency}_${toCurrency}`,
          amount,
          convertedAmount,
          baseRate,
          effectiveRate,
          markupPercent,
          profitEarned: profit,
        });
        await exchangeDoc.save({ session });
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }

      // --- Notify SSE & Redis ---
      notifyUser(userId, { type: "exchange_complete", data: { fromCurrency, toCurrency, amount, convertedAmount } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "exchange_complete", fromCurrency, toCurrency, amount, convertedAmount } })
      );

      console.log(`✅ Exchange completed for user ${userId}`);
    } catch (err) {
      console.error("❌ Exchange failed:", err.message);
      throw err;
    }
  });
})();

// Placeholder FX API function
async function getBaseRate(from, to) {
  // TODO: Replace with real FX API
  return 1; // 1:1 dummy rate
    }
