const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const Withdrawal = require("../models/Withdrawal");
const MarkupSetting = require("../models/markupSettings");
const { rapydRequest } = require("../services/rapydService");

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, withdrawalId } = job;
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return;

    try {
      withdrawal.status = "processing";
      await withdrawal.save();

      // apply markup
      const markup = await MarkupSetting.findOne({ type: "withdrawal" });
      const markupAmount = markup ? (withdrawal.amount * markup.percentage) / 100 : 0;
      const finalAmount = withdrawal.amount - markupAmount;

      withdrawal.markupPercent = markup ? markup.percentage : 0;
      withdrawal.finalAmount = finalAmount;
      await withdrawal.save();

      // Rapyd payout
      const response = await rapydRequest("POST", "/v1/payouts", {
        amount: finalAmount,
        currency: withdrawal.currency,
        bank_account_id: withdrawal.bankAccountId,
        metadata: { userId },
      });

      withdrawal.status = "completed";
      withdrawal.transactionId = response.data.id;
      await withdrawal.save();

      notifyUser(userId, { type: "withdrawal_complete", data: withdrawal });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "withdrawal_complete", withdrawal } })
      );

      console.log(`✅ Withdrawal completed: ${withdrawalId}`);
    } catch (err) {
      withdrawal.status = "failed";
      await withdrawal.save();
      console.error("❌ Withdrawal failed:", err.message);
    }
  });
})();
