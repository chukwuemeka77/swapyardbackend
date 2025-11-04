// src/workers/recurringWorker.js
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
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { userId, walletId, amount, currency, transactionId } = job;
    console.log("📆 Processing recurring payment:", transactionId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await Wallet.findById(walletId).session(session);
      if (!wallet) throw new Error("Wallet not found");

      const markup = await MarkupSetting.findOne({ type: "recurring" });
      const markupPercent = markup ? markup.percentage : 0;
      const markupAmount = amount * (markupPercent / 100);
      const totalDebit = amount + markupAmount;

      if (wallet.balance < totalDebit) throw new Error("Insufficient funds for recurring payment");

      // ✅ Transfer markup to Swapyard Rapyd wallet
      await rapydRequest("post", "/v1/account/transfer", {
        source_ewallet: wallet.rapydEwalletId,
        destination_ewallet: SWAPYARD_EWALLET_ID,
        amount: markupAmount,
        currency,
      });

      wallet.balance -= totalDebit;
      await wallet.save({ session });

      await Transaction.findByIdAndUpdate(
        transactionId,
        { status: "completed", amount },
        { session }
      );

      await session.commitTransaction();

      notifyUser(userId, { type: "recurring_payment_complete", data: { amount, currency } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "recurring_payment_complete", amount, currency } })
      );

      console.log(`✅ Recurring payment done for ${userId}, markup sent to Swapyard.`);
    } catch (err) {
      await session.abortTransaction();
      console.error("❌ Recurring payment failed:", err.message);
    } finally {
      session.endSession();
    }
  });
})();
