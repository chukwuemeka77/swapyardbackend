const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const BankAccount = require("../models/BankAccount");
const { set, get } = require("../utils/cache");
const { sendRapydPayout } = require("../services/bankPayoutService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("withdrawalQueue", async (job) => {
    const { userId, amount, currency, transactionId, bankAccountId } = job;
    console.log("🏦 Processing withdrawal:", transactionId);

    try {
      // 1️⃣ Get markup dynamically
      let markupPercent = get("withdrawalMarkup");
      if (markupPercent === null) {
        const markup = await MarkupSetting.findOne({ type: "withdrawal" });
        markupPercent = markup ? markup.percentage : 0;
        set("withdrawalMarkup", markupPercent, 300);
      }

      const finalAmount = amount * (1 - markupPercent / 100);

      // 2️⃣ Start MongoDB transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Deduct from wallet
        await Wallet.findByIdAndUpdate(
          job.walletId,
          { $inc: { balance: -amount } },
          { session }
        );

        // Mark transaction completed
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

      // 3️⃣ Fetch bank account
      const bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount || !bankAccount.verified) throw new Error("Bank account not found or unverified");

      // 4️⃣ Send payout via Rapyd
      const payoutResult = await sendRapydPayout(bankAccount, finalAmount, currency, transactionId);
      console.log("💵 Payout sent:", payoutResult);

      // 5️⃣ Notify user via SSE & Redis Pub/Sub
      notifyUser(userId, { type: "withdrawal_complete", data: { amount: finalAmount, currency } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "withdrawal_complete", amount: finalAmount, currency } })
      );

      console.log(`✅ Withdrawal completed for ${userId} (final: ${finalAmount})`);
    } catch (err) {
      console.error("❌ Withdrawal failed:", err.message);
      throw err;
    }
  });
})();
