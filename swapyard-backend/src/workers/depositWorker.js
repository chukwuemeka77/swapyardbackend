const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSetting");
const Wallet = require("../models/Wallet");

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency } = job;
    console.log("💰 Processing deposit:", job);

    // ✅ Fetch deposit markup
    const markup = await MarkupSetting.findOne({ type: "deposit" });
    const markupPercent = markup ? markup.percentage : 0;

    const finalAmount = amount * (1 - markupPercent / 100); // user gets this
    const profitEarned = amount - finalAmount;

    // 💾 Update wallet
    await Wallet.findOneAndUpdate(
      { userId, currency },
      { $inc: { balance: finalAmount } },
      { upsert: true }
    );

    // Notify user via SSE
    notifyUser(userId, {
      type: "deposit_complete",
      data: { amount: finalAmount, currency, profitEarned, markupPercent },
    });

    // Publish to Redis Pub/Sub for cross-instance
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: { type: "deposit_complete", amount: finalAmount, currency, profitEarned, markupPercent },
      })
    );

    console.log(`✅ Deposit completed for ${userId} | Profit: ${profitEarned}`);
  });
})();
