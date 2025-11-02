// src/workers/withdrawalWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const Wallet = require("../models/Wallet"); // your wallet model
const Transaction = require("../models/Transaction"); // optional transaction model

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, bankAccount, amount, effectiveAmount, markupPercent } = job;
    console.log("💸 Processing withdrawal:", job);

    try {
      // simulate API call to Rapyd or bank payout
      await new Promise((r) => setTimeout(r, 2000));

      // optionally reduce wallet balance
      await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: -amount } });

      // save transaction in DB
      await Transaction.create({
        userId,
        type: "withdrawal",
        amount,
        effectiveAmount,
        currency: bankAccount.currency,
        status: "completed",
        metadata: { bankAccount, markupPercent },
      });

      // Notify via SSE
      notifyUser(userId, {
        type: "withdrawal_complete",
        data: { amount, effectiveAmount, bankAccount, markupPercent },
      });

      // Publish to Redis for other instances
      await redisClient.publish(
        "notifications",
        JSON.stringify({
          userId,
          data: { type: "withdrawal_complete", amount, effectiveAmount, bankAccount, markupPercent },
        })
      );

      console.log(`✅ Withdrawal completed for ${userId}`);
    } catch (err) {
      console.error("❌ Withdrawal failed:", err.message || err);
      // optionally handle retries or push to failed queue
    }
  });
})();
