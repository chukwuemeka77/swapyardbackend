// src/workers/withdrawalWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { set, get } = require("../utils/cache");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccount, walletId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    // Determine domestic vs international
    const wallet = await Wallet.findById(walletId);
    const markupType =
      bankAccount.country === wallet.country ? "withdrawal" : "withdrawal_international";

    let markupPercent = get(markupType);
    if (markupPercent === null) {
      const markup = await MarkupSetting.findOne({ type: markupType });
      markupPercent = markup ? markup.percentage : 0;
      set(markupType, markupPercent, 300);
    }

    const finalAmount = amount * (1 - markupPercent / 100); // user gets less

    // Update DB atomically
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
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

    // TODO: Integrate Rapyd bank payout API here using bankAccount info

    notifyUser(userId, { type: "withdrawal_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "withdrawal_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Withdrawal completed for ${userId} (final: ${finalAmount})`);
  });
})();
