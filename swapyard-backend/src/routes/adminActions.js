// src/routes/adminActions.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const Transaction = require("../models/Transaction");
const { publishToQueue } = require("../services/rabbitmqService");
const { rapydRequest } = require("../services/rapydService");

// List transactions with failed markup transfers
router.get("/markup/failed", auth, adminAuth, async (req, res) => {
  try {
    const failed = await Transaction.find({ markupTransferStatus: "failed" }).sort({ updatedAt: -1 }).limit(200);
    res.json({ success: true, data: failed });
  } catch (err) {
    console.error("adminActions.markup.failed:", err);
    res.status(500).json({ error: "Failed to fetch failed markup transfers" });
  }
});

// Retry markup transfer for a transaction by id
router.post("/markup/:txId/retry", auth, adminAuth, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.txId);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (!tx.markupAmount || tx.markupAmount <= 0) return res.status(400).json({ error: "No markup to transfer" });

    // attempt immediate retry via Rapyd
    try {
      const transferPayload = {
        source_ewallet: tx.walletId || tx.metadata?.sourceEwallet,
        destination_ewallet: process.env.SWAPYARD_WALLET_ID,
        amount: tx.markupAmount,
        currency: tx.currency,
        metadata: { transactionId: tx._id.toString(), adminRetry: true },
      };
      await rapydRequest("POST", "/v1/account/transfer", transferPayload);

      tx.markupTransferStatus = "succeeded";
      await tx.save();
      return res.json({ success: true, message: "Markup transfer retried and succeeded" });
    } catch (err) {
      console.error("admin retry rapyd error:", err.response?.data || err.message || err);
      // keep markupTransferStatus as failed, record last error
      tx.markupTransferStatus = "failed";
      tx.markupTransferError = err.message || JSON.stringify(err.response?.data || err);
      await tx.save();
      return res.status(500).json({ error: "Retry attempt failed" });
    }
  } catch (err) {
    console.error("adminActions.markup.retry:", err);
    res.status(500).json({ error: "Failed to retry markup transfer" });
  }
});

// Admin can enqueue a retry job instead of immediate Rapyd call
router.post("/transactions/:id/requeue", auth, adminAuth, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    const payload = {
      userId: tx.userId.toString(),
      walletId: tx.walletId ? tx.walletId.toString() : undefined,
      amount: tx.amount,
      currency: tx.currency,
      transactionId: tx._id.toString(),
    };

    // map types to queues
    const map = { deposit: "depositQueue", withdrawal: "withdrawalQueue", payment: "paymentQueue", exchange: "exchangeQueue", recurring: "recurringPaymentQueue" };
    const queue = map[tx.type];
    if (!queue) return res.status(400).json({ error: "Unknown queue for transaction type" });

    await publishToQueue(queue, payload);
    res.json({ success: true, message: "Requeued transaction for processing", queue });
  } catch (err) {
    console.error("adminActions.requeue:", err);
    res.status(500).json({ error: "Failed to requeue transaction" });
  }
});

module.exports = router;
