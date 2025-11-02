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
    const { userId, amount, currency, walletId, transactionId, bankAccountId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    // 1️⃣ Get markup
    const markup = await MarkupSetting.findOne({ type: "withdrawal" });
    const markupPercent = markup ? markup.percentage : 0;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount - markupAmount; // user gets less

    // 2️⃣ Update wallet and transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    // 3️⃣ Payout to user's bank via Rapyd
    await rapydRequest("post", `/v1/payouts`, {
      amount: finalAmount.toFixed(2),
      currency,
      bank_account_id: bankAccountId,
      metadata: { transactionId, type: "withdrawal", userId },
    });

    // 4️⃣ Move markup to Swapyard wallet
    if (markupAmount > 0) {
      await rapydRequest("post", `/v1/account/transfer`, {
        source_ewallet: walletId,
        destination_ewallet: process.env.SWAPYARD_WALLET_ID,
        amount: markupAmount.toFixed(2),
        currency,
        metadata: { transactionId, type: "markup_fee", userId },
      });
    }

    // 5️⃣ Notify user
    notifyUser(userId, { type: "withdrawal_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "withdrawal_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Withdrawal completed for ${userId} (markup: ${markupAmount})`);
  });
})();
