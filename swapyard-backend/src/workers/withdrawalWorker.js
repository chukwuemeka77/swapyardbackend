const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction"); // track withdrawals

(async () => {
  await consumeQueue("withdrawQueue", async (job) => {
    const { userId, amount, currency, bankAccountId, transactionId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "withdraw" });
    const markupPercent = markup ? markup.percentage : 0;
    const finalAmount = amount * (1 - markupPercent / 100); // deduct markup

    // Simulate bank payout
    await new Promise((r) => setTimeout(r, 3000));

    await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount });

    notifyUser(userId, { type: "withdraw_complete", data: { amount: finalAmount, currency, bankAccountId } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "withdraw_complete", amount: finalAmount, currency, bankAccountId } })
    );

    console.log(`✅ Withdrawal completed for ${userId} (final: ${finalAmount})`);
  });
})();
