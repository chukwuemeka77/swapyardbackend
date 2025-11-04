// src/workers/paymentWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, amount, currency, transactionId } = job;
    console.log("💳 Processing payment:", transactionId);

    // Get markup
    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupPercent = markup ? markup.percentage : 0;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount + markupAmount;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
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
        description: `Payment markup from user ${userId}`,
      });
    }

    // Notify
    notifyUser(userId, { type: "payment_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "payment_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Payment completed for ${userId} (final: ${finalAmount})`);
  });
})();
