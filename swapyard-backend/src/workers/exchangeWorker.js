// src/workers/exchangeWorker.js
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
  await consumeQueue("exchangeQueue", async (job) => {
    const { userId, fromWalletId, toWalletId, amount, fromCurrency, toCurrency, transactionId } = job;
    console.log("🔄 Processing exchange:", transactionId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const fromWallet = await Wallet.findById(fromWalletId).session(session);
      const toWallet = await Wallet.findById(toWalletId).session(session);
      if (!fromWallet || !toWallet) throw new Error("Wallet not found");

      // Get markup
      const markup = await MarkupSetting.findOne({ type: "exchange" });
      const markupPercent = markup ? markup.percentage : 0;
      const markupAmount = amount * (markupPercent / 100);

      // ✅ Deduct + Transfer markup to Swapyard
      await rapydRequest("post", "/v1/account/transfer", {
        source_ewallet: fromWallet.rapydEwalletId,
        destination_ewallet: SWAPYARD_EWALLET_ID,
        amount: markupAmount,
        currency: fromCurrency,
      });

      // ✅ Simulated conversion via Rapyd FX endpoint
      const converted = await rapydRequest("post", "/v1/fxrates/convert", {
        source_currency: fromCurrency,
        target_currency: toCurrency,
        amount: amount - markupAmount,
      });

      const convertedAmount = converted.data.amount || (amount - markupAmount);

      fromWallet.balance -= amount;
      toWallet.balance += convertedAmount;

      await fromWallet.save({ session });
      await toWallet.save({ session });

      await Transaction.findByIdAndUpdate(
        transactionId,
        { status: "completed", amount: convertedAmount },
        { session }
      );

      await session.commitTransaction();

      notifyUser(userId, { type: "exchange_complete", data: { fromCurrency, toCurrency, amount: convertedAmount } });
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: { type: "exchange_complete", fromCurrency, toCurrency, amount: convertedAmount } })
      );

      console.log(`✅ Exchange completed for ${userId}, markup sent to Swapyard.`);
    } catch (err) {
      await session.abortTransaction();
      console.error("❌ Exchange failed:", err.message);
    } finally {
      session.endSession();
    }
  });
})();
