const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const ExchangeProfit = require("../models/ExchangeProfit");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const GLOBAL_MARKUP = parseFloat(process.env.MARKUP_PERCENT) || 0;
const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;

(async () => {
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, amount, pair, transactionId, baseRate } = job;
    console.log("💱 Processing exchange:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "exchange" });
    const markupPercent = markup ? markup.percentage : GLOBAL_MARKUP;
    const effectiveRate = baseRate * (1 - markupPercent / 100);
    const convertedAmount = amount * effectiveRate;
    const profit = amount * baseRate - convertedAmount;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await ExchangeProfit.create([{ userId, pair, amount, convertedAmount, baseRate, effectiveRate, markupPercent, profit, transactionId }], { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    if (SWAPYARD_WALLET_ID && profit > 0) {
      try {
        await rapydRequest("POST", `/v1/account/transfer`, {
          source_ewallet: userId,
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: profit,
          currency: pair.split("/")[1],
        });
      } catch (err) {
        console.error("❌ Failed to move exchange profit to Swapyard wallet:", err.message);
      }
    }

    notifyUser(userId, { type: "exchange_complete", data: { amount, convertedAmount, pair } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "exchange_complete", amount, convertedAmount, pair } })
    );

    console.log(`✅ Exchange completed for ${userId} (profit: ${profit})`);
  });
})();
