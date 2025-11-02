const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");
const Transaction = require("../models/Transaction");
const { rapydRequest } = require("../services/rapydService");
const mongoose = require("mongoose");

(async () => {
  await consumeQueue("recurringPaymentQueue", async (job) => {
    const { userId, amount, currency, walletId, transactionId, scheduleId } = job;
    console.log("💳 Processing recurring payment:", transactionId);

    // 1️⃣ Get markup
    const markup = await MarkupSetting.findOne({ type: "recurring" });
    const markupPercent = markup ? markup.percentage : 0;
    const markupAmount = amount * (markupPercent / 100);
    const finalAmount = amount + markupAmount;

    // 2️⃣ Update transaction in DB
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

    // 3️⃣ Move markup to Swapyard wallet
