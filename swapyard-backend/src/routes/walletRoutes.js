// src/routes/walletRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const { sendToWithdrawalQueue } = require("../services/rabbitmqService");
const BankAccount = require("../models/BankAccount");
const MarkupSetting = require("../models/MarkupSetting");

// ==================== Request withdrawal ====================
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { bankAccountId, amount } = req.body;

    // fetch verified bank account
    const account = await BankAccount.findOne({ _id: bankAccountId, userId: req.user.id, isVerified: true });
    if (!account) return res.status(400).json({ error: "Invalid or unverified bank account" });

    // get markup for withdrawals
    const markup = await MarkupSetting.findOne({ type: "withdrawal" });
    const percentage = markup ? markup.percentage : 0;
    const effectiveAmount = amount - (amount * percentage) / 100;

    // push withdrawal job to RabbitMQ
    await sendToWithdrawalQueue({
      userId: req.user.id,
      bankAccount: account,
      amount,
      effectiveAmount,
      markupPercent: percentage,
    });

    res.json({ success: true, message: "Withdrawal request queued" });
  } catch (err) {
    console.error("Withdrawal request failed:", err);
    res.status(500).json({ error: "Failed to request withdrawal" });
  }
});

module.exports = router;
