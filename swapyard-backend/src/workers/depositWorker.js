// src/workers/depositWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const { fetchDepositFromBank } = require("../services/bankPayoutService");

// Start consuming the deposit queue
(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccountId } = job;
    console.log("💰 Processing deposit:", transactionId);

    try {
      // ✅ Fetch markup for deposit
      const markup = await MarkupSetting.findOne({ type: "deposit" });
      const markupPercent = markup ? markup.percentage : 0;
      const finalAmount = amount * (1 + markupPercent / 100);

      // ✅ If bankAccountId exists, fetch deposit from bank
      let rapydResponse = null;
      if (bankAccountId) {
        rapydResponse = await fetchDepositFromBank(bankAccountId, finalAmount, currency);
        console.log("💳 Rapyd deposit response:", rapydResponse);
      }

      // ✅ Update Transaction
      await Transaction.findByIdAndUpdate(transactionId, {
        status: "completed",
        amount: finalAmount,
      });

      // ✅ Notify user via SSE
      notifyUser(userId, { type: "deposit_complete", data: { amount: finalAmount, currency } });

      // ✅ Publish to Redis Pub/Sub for cross-instance updates
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "deposit_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Deposit completed for ${userId} (final amount: ${finalAmount})`);
    } catch (err) {
      console.error("❌ Deposit failed:", err.message);
      // Optionally: requeue the job or mark failed
      throw err;
    }
  });
})();
