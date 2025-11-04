// src/workers/withdrawalWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, amount, currency, transactionId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    // Get markup
    const markup = await MarkupSetting.findOne({ type: "withdrawal" });
    const markupPercent = markup ? markup.percentage : 0;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount - markupAmount; // user receives less

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Deduct from user wallet
      await Wallet.findByIdAndUpdate(
        job.walletId,
        { $inc: { balance: -amount } },
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

    // Move markup to Swapyard wallet
    const swapyardWallet = await Wallet.findOne({ isSwapyard: true });
    if (markupAmount > 0 && swapyardWallet?.rapydWalletId) {
      await rapydRequest("POST", `/wallets/${swapyardWallet.rapydWalletId}/transactions`, {
        amount: markupAmount,
        currency,
        type: "credit",
        description: `Withdrawal markup from user ${userId}`,
      });
    }

    notifyUser(userId, { type: "withdrawal_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "withdrawal_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Withdrawal completed for ${userId} (final: ${finalAmount})`);
  });
})();
