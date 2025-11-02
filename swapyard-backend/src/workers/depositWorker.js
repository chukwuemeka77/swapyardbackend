const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction"); // if you track deposits

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency, transactionId } = job;
    console.log("💰 Processing deposit:", transactionId);

    // Get markup for deposit
    const markup = await MarkupSetting.findOne({ type: "deposit" });
    const markupPercent = markup ? markup.percentage : 0;
    const finalAmount = amount * (1 + markupPercent / 100);

    // Simulate processing
    await new Promise((r) => setTimeout(r, 2000));

    // Update Transaction (optional)
    await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount });

    // Notify via SSE
    notifyUser(userId, { type: "deposit_complete", data: { amount: finalAmount, currency } });

    // Publish to Redis Pub/Sub
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "deposit_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Deposit completed for ${userId} (final amount: ${finalAmount})`);
  });
})();
