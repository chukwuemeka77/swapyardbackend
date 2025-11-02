const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction"); // optional payment tracking

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { id, userId, amount, currency } = job;
    console.log("💳 Processing payment:", id);

    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupPercent = markup ? markup.percentage : 0;
    const finalAmount = amount * (1 + markupPercent / 100);

    await Transaction.findByIdAndUpdate(id, { status: "completed", amount: finalAmount });

    notifyUser(userId, { type: "payment_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "payment_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Payment processed for ${userId} (final amount: ${finalAmount})`);
  });
})();
