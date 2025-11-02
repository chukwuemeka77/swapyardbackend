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
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccountId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    const markup = await MarkupSetting.findOne({ type: "withdrawal" });
    const markupPercent = markup ? markup.percentage : GLOBAL_MARKUP;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount - markupAmount; // user receives less

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Deduct from wallet
      await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: -amount } }, { session });
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    // Rapyd payout
    try {
      await rapydRequest("POST", `/v1/payouts`, {
        ewallet: bankAccountId,
        amount: finalAmount,
        currency,
      });
    } catch (err) {
      console.error("❌ Withdrawal payout failed:", err.message);
    }

    // Move markup to Swapyard wallet
    if (SWAPYARD_WALLET_ID && markupAmount > 0) {
      try {
        await rapydRequest("POST", `/v1/account/transfer`, {
          source_ewallet: bankAccountId,
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
        });
      } catch (err) {
        console.error("❌ Failed to move withdrawal markup:", err.message);
      }
    }

    notifyUser(userId, { type: "withdrawal_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "withdrawal_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Withdrawal completed for ${userId} (final: ${finalAmount})`);
  });
})();
