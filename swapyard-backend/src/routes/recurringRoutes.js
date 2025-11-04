// src/routes/recurringRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const RecurringPayment = require("../models/RecurringPayment");
const Transaction = require("../models/Transaction");
const { publishToQueue } = require("../services/rabbitmqService");
const MarkupSetting = require("../models/markupSettings");

// Create recurring payment
router.post("/create", auth, async (req, res) => {
  try {
    const { walletId, amount, currency, frequency, startAt, description } = req.body;
    if (!walletId || !amount || !currency || !frequency) {
      return res.status(400).json({ error: "walletId, amount, currency and frequency are required" });
    }

    const nextRun = startAt ? new Date(startAt) : new Date();

    const recurring = await RecurringPayment.create({
      userId: req.user.id,
      walletId,
      amount,
      currency,
      frequency,
      nextRun,
      description,
      active: true,
    });

    // transaction created when scheduler enqueues the job; optionally enqueue first run immediately:
    await publishToQueue("recurringPaymentQueue", {
      userId: req.user.id,
      walletId,
      amount,
      currency,
      transactionId: `txn_${Date.now()}`, // temporary tx id; scheduler will create official txs
      scheduleId: recurring._id.toString(),
    });

    res.json({ success: true, recurring });
  } catch (err) {
    console.error("❌ create recurring failed:", err);
    res.status(500).json({ error: "Failed to create recurring payment" });
  }
});

// List user's recurring payments
router.get("/", auth, async (req, res) => {
  try {
    const list = await RecurringPayment.find({ userId: req.user.id });
    res.json({ success: true, data: list });
  } catch (err) {
    console.error("❌ list recurring failed:", err);
    res.status(500).json({ error: "Failed to list recurring payments" });
  }
});

// Cancel/disable recurring payment
router.post("/:id/cancel", auth, async (req, res) => {
  try {
    const r = await RecurringPayment.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { active: false }, { new: true });
    if (!r) return res.status(404).json({ error: "Not found or unauthorized" });
    res.json({ success: true, recurring: r });
  } catch (err) {
    console.error("❌ cancel recurring failed:", err);
    res.status(500).json({ error: "Failed to cancel recurring payment" });
  }
});

module.exports = router;
