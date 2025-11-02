// src/workers/depositWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { set, get } = require("../utils/cache");

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccount, walletId } = job;
    console.log("💰 Processing deposit:", transactionId);

    // Determine domestic vs international
    const wallet = await Wallet.findById(walletId);
    const markupType =
      bankAccount.country === wallet.country ? "deposit" : "deposit_international";

    let markupPercent = get(markupType);
    if (markupPercent === null) {
      const markup = await MarkupSetting.findOne({ type: markupType });
      markupPercent = markup ? markup.percentage : 0;
      set(markupType, markupPercent, 300); // cache 5 minutes
    }

    const finalAmount = amount * (1 + markupPercent / 100);

    // Update Transaction
    await Transaction.findByIdAndUpdate(transactionId, {
      status: "completed",
      amount: finalAmount,
    });

    // Notify user via SSE
    notifyUser(userId, { type: "deposit_complete", data: { amount: finalAmount, currency } });

    // Publish to Redis for cross-instance
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "deposit_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Deposit completed for ${userId} (final amount: ${finalAmount})`);
  });
})();
