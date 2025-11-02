const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const GLOBAL_MARKUP = parseFloat(process.env.MARKUP_PERCENT) || 0;
const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { userId, amount, currency, walletId, transactionId, scheduleId } = job;
    console.log("💳 Processing recurring payment:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "recurring" });
    const markupPercent = markup ? markup.percentage : GLOBAL_MARKUP;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount + markupAmount;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: finalAmount } }, { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    if (SWAPYARD_WALLET_ID && markupAmount > 0) {
      try {
        await rapydRequest("POST", `/v1/account/transfer`, {
          source_ewallet: walletId,
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
        });
      } catch (err) {
        console.error("❌ Failed to move recurring markup:", err.message);
      }
    }

    notifyUser(userId, { type: "recurring_payment_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "recurring_payment_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Recurring payment completed for ${userId} (final: ${finalAmount})`);
  });
})();
