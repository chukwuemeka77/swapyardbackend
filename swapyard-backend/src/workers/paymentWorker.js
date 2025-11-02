const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

const GLOBAL_MARKUP = parseFloat(process.env.MARKUP_PERCENT) || 0;
const SWAPYARD_WALLET_ID = process.env.SWAPYARD_WALLET_ID;

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, amount, currency, transactionId } = job;
    console.log("💳 Processing payment:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupPercent = markup ? markup.percentage : GLOBAL_MARKUP;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount + markupAmount;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
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
          source_ewallet: userId, // or payment source
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
        });
      } catch (err) {
        console.error("❌ Failed to move payment markup:", err.message);
      }
    }

    notifyUser(userId, { type: "payment_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "payment_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Payment completed for ${userId} (final: ${finalAmount})`);
  });
})();
