// routes/rapydWebhook.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Transaction = require("../models/Transaction");
const WebhookLog = require("../models/WebhookLog");

const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY; // from Rapyd Dashboard

// ===== Middleware: verify Rapyd HMAC signature =====
function verifyRapydSignature(req, res, next) {
  try {
    const signature = req.headers["signature"]; // Rapyd sends this
    if (!signature) {
      return res.status(401).json({ error: "Missing Rapyd signature" });
    }

    // Use Buffer (since express.raw is enabled for this route in server.js)
    const rawBody = req.body instanceof Buffer
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const hmac = crypto
      .createHmac("sha256", RAPYD_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (hmac !== signature) {
      return res.status(401).json({ error: "Invalid Rapyd signature" });
    }

    // Parse JSON so downstream handlers can use it normally
    if (req.body instanceof Buffer) {
      req.body = JSON.parse(rawBody.toString("utf8"));
    }

    next();
  } catch (err) {
    console.error("Signature verification error:", err);
    return res.status(401).json({ error: "Rapyd signature verification failed" });
  }
}

// ===== Handle Rapyd webhooks =====
router.post("/", verifyRapydSignature, async (req, res) => {
  const event = req.body;

  let webhookLog;
  try {
    // 1. Save EVERY webhook (raw payload)
    webhookLog = new WebhookLog({
      eventType: event.type || "unknown",
      raw: event,
      status: "received",
    });
    await webhookLog.save();

    // 2. Process only transaction-related events
    if (
      event.type &&
      [
        "payment.completed",
        "payment.failed",
        "transfer.completed",
        "transfer.failed",
        "wallet.transaction",
      ].includes(event.type)
    ) {
      const data = event.data || {};

      // Map Rapyd payload to our Transaction model
      const txFields = {
        referenceId: data.id, // Rapyd’s unique ID
        type: mapRapydEventToType(event.type),
        amount: data.amount,
        currency: data.currency,
        status: mapRapydStatus(event.type),
        description: data.description || `Rapyd ${event.type}`,
        metadata: data,
      };

      // 3. Upsert Transaction (avoid duplicates with referenceId)
      let transaction = await Transaction.findOneAndUpdate(
        { referenceId: data.id },
        txFields,
        { new: true, upsert: true }
      );

      // 4. Link webhookLog → transaction
      webhookLog.transaction = transaction._id;
      webhookLog.status = "processed";
      await webhookLog.save();
    } else {
      // Not a transaction-related event
      webhookLog.status = "ignored";
      await webhookLog.save();
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (err) {
    console.error("Rapyd webhook processing error:", err);

    if (webhookLog) {
      webhookLog.status = "failed";
      webhookLog.errorMessage = err.message;
      await webhookLog.save();
    }

    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ===== Helpers =====
function mapRapydEventToType(eventType) {
  switch (eventType) {
    case "payment.completed":
      return "deposit";
    case "payment.failed":
      return "deposit";
    case "transfer.completed":
      return "transfer";
    case "transfer.failed":
      return "transfer";
    case "wallet.transaction":
      return "payment"; // general wallet txn
    default:
      return "payment";
  }
}

function mapRapydStatus(eventType) {
  if (eventType.includes("failed")) return "failed";
  if (eventType.includes("completed")) return "success";
  return "pending";
}

module.exports = router;
