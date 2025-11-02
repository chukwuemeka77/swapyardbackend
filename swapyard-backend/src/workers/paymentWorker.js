const { consumeQueue } = require("../services/rabbitmqService");
const MarkupSetting = require("../models/markupSettings");
const Wallet = require("../models/Wallet");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId } = job;

    console.log("💳 Processing payment:", job);

    try {
      // 1️⃣ Get payment markup
      const markup = await MarkupSetting.findOne({ type: "payment" });
      const markupPercent = markup ? markup.percentage : 0;

      // 2️⃣ Calculate effective amount charged
      const effectiveAmount = amount * (1 + markupPercent / 100); // charge slightly more

      // 3️⃣ Deduct from wallet
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -effectiveAmount } });

      // 4️⃣ Notify user via SSE
      notifyUser(userId, {
        type: "payment_processed",
        data: { amount, effectiveAmount, currency, markupPercent, transactionId },
      });

      // 5️⃣ Publish to Redis for cross-instance notification
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId,
          data: { type: "payment_processed", amount, effectiveAmount, currency, markupPercent, transactionId },
        })
      );

      console.log(`✅ Payment processed for user ${userId}: charged ${effectiveAmount}`);
    } catch (err) {
      console.error("❌ Payment worker error:", err.message);
    }
  });
})();
