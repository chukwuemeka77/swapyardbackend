// src/routes/walletRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const { enqueueJob } = require("../services/rabbitmqService");
const Transaction = require("../models/Transaction");
const BankAccount = require("../models/BankAccount");
const Wallet = require("../models/Wallet");

// ==================== Deposit ====================
router.post("/deposit", auth, async (req, res) => {
  try {
    const { amount, currency, bankAccountId } = req.body;
    const bankAccount = await BankAccount.findById(bankAccountId);
    const wallet = await Wallet.findOne({ userId: req.user.id });

    const transaction = await Transaction.create({
      userId: req.user.id,
      walletId: wallet._id,
      amount,
      currency,
      type: "deposit",
      status: "pending",
    });

    await enqueueJob("depositQueue", {
      userId: req.user.id,
      walletId: wallet._id,
      amount,
      currency,
      transactionId: transaction._id,
      bankAccount,
    });

    res.json({ success: true, transactionId: transaction._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Deposit failed" });
  }
});

// ==================== Withdrawal ====================
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, currency, bankAccountId } = req.body;
    const bankAccount = await BankAccount.findById(bankAccountId);
    const wallet = await Wallet.findOne({ userId: req.user.id });

    const transaction = await Transaction.create({
      userId: req.user.id,
      walletId: wallet._id,
      amount,
      currency,
      type: "withdrawal",
      status: "pending",
    });

    await enqueueJob("withdrawalQueue", {
      userId: req.user.id,
      walletId: wallet._id,
      amount,
      currency,
      transactionId: transaction._id,
      bankAccount,
    });

    res.json({ success: true, transactionId: transaction._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Withdrawal failed" });
  }
});

module.exports = router;
