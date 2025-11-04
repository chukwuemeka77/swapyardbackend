const cron = require("node-cron");
const RecurringPayment = require("../models/RecurringPayment");
const Transaction = require("../models/Transaction");
const { publishToQueue } = require("../services/rabbitmqService");

// Schedule: every minute (adjust if needed)
cron.schedule("* * * * *", async () => {
  try {
    console.log("🕒 recurringScheduler: checking for due recurring payments...");
    const now = new Date();
    const due = await RecurringPayment.find({ nextRun: { $lte: now }, active: true });

    for (const payment of due) {
      // create a transaction record
      const tx = await Transaction.create({
        userId: payment.userId,
        walletId: payment.walletId,
        amount: payment.amount,
        currency: payment.currency,
        type: "recurring",
        status: "pending",
        metadata: { recurringPaymentId: payment._id.toString() },
      });

      // publish job to the recurring queue
      await publishToQueue("recurringPaymentQueue", {
        userId: payment.userId.toString(),
        walletId: payment.walletId.toString(),
        amount: payment.amount,
        currency: payment.currency,
        transactionId: tx._id.toString(),
        scheduleId: payment._id.toString(),
      });

      // compute nextRun
      const next = new Date(payment.nextRun);
      if (payment.frequency === "daily") next.setDate(next.getDate() + 1);
      else if (payment.frequency === "weekly") next.setDate(next.getDate() + 7);
      else if (payment.frequency === "monthly") next.setMonth(next.getMonth() + 1);

      payment.nextRun = next;
      await payment.save();
      console.log(`🔁 scheduled recurring job for payment ${payment._id} next run ${payment.nextRun}`);
    }
  } catch (err) {
    console.error("❌ recurringScheduler error:", err.message || err);
  }
});

module.exports = {}; // no exports needed, file import starts the cron
