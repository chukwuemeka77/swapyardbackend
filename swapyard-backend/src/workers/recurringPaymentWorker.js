// src/workers/recurringPaymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const RecurringPayment = require("../models/RecurringPayment");
const { rapydRequest } = require("../services/rapydService");

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { paymentId } = job;
    const recurring = await RecurringPayment.findById(paymentId);
    if (!recurring || recurring.status !== "active") return;

    // Fetch markup from markupSettings
    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupPercent = markup ? markup.percentage : 0;

    const finalAmount = recurring.amount * (1 + markupPercent / 100);

    try {
      // Call Rapyd API to pay user (wallet or bank account)
      await rapydRequest("POST", "/v1/payouts", {
        beneficiary: { type: "wallet", id: recurring.userId },
        amount: finalAmount,
        currency: recurring.currency,
      });

      // Notify user via SSE
      notifyUser(recurring.userId, {
        type: "recurring_payment_complete",
        data: { amount: finalAmount, currency: recurring.currency, paymentId },
      });

      // Publish to Redis for cross-instance notification
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId: recurring.userId,
          data: { type: "recurring_payment_complete", amount: finalAmount, currency: recurring.currency }
        })
      );

      console.log(`✅ Recurring payment executed for ${recurring.userId} (paymentId: ${paymentId})`);
    } catch (err) {
      console.error("❌ Recurring payment failed:", err.message);
    }
  });
})();
