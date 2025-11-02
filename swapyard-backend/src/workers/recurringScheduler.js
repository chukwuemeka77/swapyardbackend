// src/workers/recurringScheduler.js
const cron = require("node-cron");
const RecurringPayment = require("../models/RecurringPayment");
const { sendToQueue } = require("../services/rabbitmqService");

// Run every minute to enqueue jobs due now
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const duePayments = await RecurringPayment.find({ nextRun: { $lte: now }, active: true });

    for (const payment of duePayments) {
      await sendToQueue("recurringPaymentQueue", {
        userId: payment.userId,
        walletId: payment.walletId,
        amount: payment.amount,
        currency: payment.currency,
        transactionId: `txn_${Date.now()}`, // generate unique transaction ID
        scheduleId: payment._id,
      });

      // Update nextRun according to interval
      let nextRun = new Date(payment.nextRun);
      if (payment.interval === "daily") nextRun.setDate(nextRun.getDate() + 1);
      if (payment.interval === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      if (payment.interval === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);

      payment.nextRun = nextRun;
      await payment.save();
    }
  } catch (err) {
    console.error("❌ Recurring payment scheduler error:", err.message);
  }
});
