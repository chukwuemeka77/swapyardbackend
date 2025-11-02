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
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccountId } = job;
    console.log("💰 Processing deposit:", transactionId);

    // 1️⃣ Get markup from DB or use .env
    const markup = await MarkupSetting.findOne({ type: "deposit" });
    const markupPercent = markup ? markup.percentage : GLOBAL_MARKUP;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount + markupAmount;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 2️⃣ Update Transaction & Wallet
      await Transaction.findByIdAndUpdate(transactionId, { status: "completed", amount: finalAmount }, { session });
      await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: finalAmount } }, { session });

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    // 3️⃣ Optionally move markup to Swapyard Rapyd wallet
    if (SWAPYARD_WALLET_ID && markupAmount > 0) {
      try {
        await rapydRequest("POST", `/v1/account/transfer`, {
          source_ewallet: bankAccountId,        // user source
          destination_ewallet: SWAPYARD_WALLET_ID,
          amount: markupAmount,
          currency,
        });
      } catch (err) {
        console.error("❌ Failed to move markup to Swapyard wallet:", err.message);
      }
    }

    // 4️⃣ Notify User
    notifyUser(userId, { type: "deposit_complete", data: { amount: finalAmount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId, data: { type: "deposit_complete", amount: finalAmount, currency } })
    );

    console.log(`✅ Deposit completed for ${userId} (final amount: ${finalAmount})`);
  });
})();
