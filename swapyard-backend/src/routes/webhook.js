// routes/webhook.js
const express = require("express");
const Transaction = require("../models/Transaction");

const router = express.Router();

// Rapyd webhook endpoint
router.post("/rapyd-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Rapyd Webhook:", event);

    // Extract transaction ID from metadata (you set this when creating Rapyd transaction)
    const txId = event?.data?.metadata?.transactionId;
    if (txId) {
      const tx = await Transaction.findById(txId);
      if (tx) {
        tx.status = event.type.includes("success") ? "success" : "failed";
        await tx.save();
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

module.exports = router;
