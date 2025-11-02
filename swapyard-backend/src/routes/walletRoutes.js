const router = require("express").Router();
const auth = require("../middleware/auth");
const { publishToQueue } = require("../services/rabbitmqService");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const BankAccount = require("../models/BankAccount");
const { get } = require("../utils/cache");
const MarkupSetting = require("../models/markupSettings");

// ==================== Request Withdrawal ====================
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, currency, bankAccountId } = req.body;

    // 1️⃣ Check wallet balance
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    // 2️⃣ Check bank account
    const bankAccount = await BankAccount.findOne({ _id: bankAccountId, userId: req.user.id });
    if (!bankAccount || !bankAccount.verified) {
      return res.status(400).json({ error: "Bank account not found or unverified" });
    }

    // 3️⃣ Create a transaction record
    const transaction = await Transaction.create({
      userId: req.user.id,
      type: "withdrawal",
      amount,
      currency,
      status: "pending",
      metadata: { bankAccountId },
    });

    // 4️⃣ Publish to RabbitMQ withdrawalQueue
    await publishToQueue("withdrawalQueue", {
      userId: req.user.id,
      walletId: wallet._id,
      transactionId: transaction._id,
      amount,
      currency,
      bankAccountId,
    });

    res.json({ success: true, message: "Withdrawal request queued", transactionId: transaction._id });
  } catch (err) {
    console.error("Withdrawal request failed:", err);
    res.status(500).json({ error: "Failed to request withdrawal" });
  }
});

module.exports = router;
