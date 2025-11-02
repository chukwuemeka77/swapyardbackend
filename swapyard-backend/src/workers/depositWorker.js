const { consumeQueue } = require("../services/rabbitmqService");
const MarkupSetting = require("../models/markupSettings");
const Wallet = require("../models/Wallet");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId } = job;

    console.log("💰 Processing deposit:", job);

    try {
      // 1️⃣ Get deposit markup
      const markup = await MarkupSetting.findOne({ type: "deposit" });
      const markupPercent = markup ? markup.percentage : 0;

      // 2️⃣ Calculate effective amount credited
      const effectiveAmount = amount * (1 - markupPercent / 100);

      // 3️⃣ Update wallet balance
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: effectiveAmount } });

      // 4️⃣ Notify user via SSE
      notifyUser(userId, {
        type: "deposit_complete",
        data: { amount, effectiveAmount, currency, markupPercent, transactionId },
      });

      // 5️⃣ Publish to Redis for cross-instance notification
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId,
          data: { type: "deposit_complete", amount, effectiveAmount, currency, markupPercent, transactionId },
        })
      );

      console.log(`✅ Deposit completed for user ${userId}: credited ${effectiveAmount}`);
    } catch (err) {
      console.error("❌ Deposit worker error:", err.message);
    }
  });
})();
