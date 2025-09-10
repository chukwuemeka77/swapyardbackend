// routes/rapydWebhook.js
const express = require("express");
const crypto = require("crypto");
const WalletService = require("../services/WalletService");
const User = require("../models/User");

const router = express.Router();

/**
 * Verify Rapyd webhook signature
 */
function verifySignature(req) {
  try {
    const secret = process.env.RAPYD_SECRET || "rapyd_secret"; // set in .env
    const body = JSON.stringify(req.body);
    const signature = req.headers["signature"];

    const hash = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    return hash === signature;
  } catch (err) {
    console.error("Signature verification failed:", err.message);
    return false;
  }
}

/**
 * Handle Rapyd Webhook Events
 */
router.post("/", async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;

    console.log("📩 Rapyd Webhook Received:", event.type);

    const { type, data } = event;

    // Example mapping - expand as needed
    switch (type) {
      case "payment.completed": {
        const user = await User.findOne({ email: data.customer_email });
        if (!user) break;

        await WalletService.deposit(user._id, data.amount, data.currency, {
          rapydPaymentId: data.id,
        });
        break;
      }

      case "payout.completed": {
        const user = await User.findOne({ email: data.customer_email });
        if (!user) break;

        await WalletService.withdraw(user._id, data.amount, data.currency, {
          rapydPayoutId: data.id,
        });
        break;
      }

      case "transfer.completed": {
        const fromUser = await User.findOne({ email: data.source_customer_email });
        const toUser = await User.findOne({ email: data.destination_customer_email });
        if (!fromUser || !toUser) break;

        await WalletService.transfer(fromUser._id, toUser._id, data.amount, data.currency, {
          rapydTransferId: data.id,
        });
        break;
      }

      case "fx.conversion.completed": {
        const user = await User.findOne({ email: data.customer_email });
        if (!user) break;

        await WalletService.fxExchange(
          user._id,
          data.amount,
          data.from_currency,
          data.to_currency,
          data.fx_rate,
          { rapydFxId: data.id }
        );
        break;
      }

      default:
        console.log("⚠️ Unhandled Rapyd event:", type);
    }

    res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("⚠️ Webhook processing error:", err.message);
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

module.exports = router;

