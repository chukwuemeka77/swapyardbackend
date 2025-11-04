// src/workers/depositWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const SWAPYARD_EWALLET_ID = process.env.SWAPYARD_EWALLET_ID;

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId } = job;
    console.log("💰 Processing deposit:", transactionId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await Wallet.findById(walletId).session(session);
      if (!wallet) throw new Error("Wallet not found");

      // Get markup
      const markup = await MarkupSetting.findOne({ type: "deposit" });
      const markupPercent = markup ? markup.percentage : 0;
      const markupAmount = amount * (markupPercent / 100);
      const finalAmount = amount - markupAmount;

      // ✅ Rapyd transfer: user pays Swapyard markup
      if (markupAmount > 0) {
        await rapydRequest("post", "/v1/account/transfer", {
          source_ewallet: wallet.rapydEwalletId,
          destination_ewallet: SWAPYARD_EWALLET_ID,
          amount: markupAmount,
          currency,
        });
      }

      // ✅ Update wallet and transaction
      wallet.balance += finalAmount;
      await wallet.save({ session });

      await Transaction.findByIdAndUpdate(
        transactionId,
        { status: "completed", amount: finalAmount },
        { session }
      );

      await session.commitTransaction();

      // Notify user
      notifyUser(userId, { type: "deposit_complete", data: { amount: finalAmount, currency } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "deposit_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Deposit completed for ${userId}, markup moved to Swapyard.`);
    } catch (err) {
      await session.abortTransaction();
      console.error("❌ Deposit failed:", err.message);
    } finally {
      session.endSession();
    }
  });
})();
