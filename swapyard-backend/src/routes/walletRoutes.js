// src/routes/walletRoutes.js
const express = require("express");
const auth = require("../middleware/auth");
const { sendToQueue } = require("../services/rabbitmqService");

const router = express.Router();
const DEPOSIT_QUEUE = "depositQueue";
const WITHDRAW_QUEUE = "withdrawQueue";

router.post("/deposit", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const userId = req.user.id;

    await sendToQueue(DEPOSIT_QUEUE, { userId, amount, currency });
    res.status(202).json({ message: "Deposit request queued successfully" });
  } catch (err) {
    console.error("Deposit route error:", err);
    res.status(500).json({ error: "Failed to queue deposit" });
  }
});

router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const userId = req.user.id;

    await sendToQueue(WITHDRAW_QUEUE, { userId, amount, currency });
    res.status(202).json({ message: "Withdrawal request queued successfully" });
  } catch (err) {
    console.error("Withdraw route error:", err);
    res.status(500).json({ error: "Failed to queue withdrawal" });
  }
});

module.exports = router;
