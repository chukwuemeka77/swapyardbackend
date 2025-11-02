// src/workers/depositWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { set, get } = require("../utils/cache");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency, transactionId } = job;
    console.log("💰 Processing deposit:", transactionId);

    try {
      // --- Fetch markup with cache ---
      let markupPercent = get("depositMarkup");
      if (markupPercent === null) {
        const markup = await MarkupSetting.findOne({ type: "deposit" });
        markupPercent = markup ? markup.percentage : 0;
        set("depositMarkup", markupPercent, 300); // cache 5 min
      }
      const finalAmount = amount * (1 + markupPercent / 100);

      // --- MongoDB transaction for atomicity ---
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Wallet.findByIdAndUpdate(
          job.walletId,
          { $inc: { balance: finalAmount } },
          { session }
        );
        await Transaction.findByIdAndUpdate(
          transactionId,
          { status: "completed", amount: finalAmount },
          { session }
        );
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }

      // --- Notify via SSE & Redis ---
      notifyUser(userId, { type: "deposit_complete", data: { amount: finalAmount, currency } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "deposit_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Deposit completed for ${userId} (final: ${finalAmount})`);
    } catch (err) {
      console.error("❌ Deposit failed:", err.message);
      throw err; // let RabbitMQ requeue or dead-letter
    }
  });
})();
