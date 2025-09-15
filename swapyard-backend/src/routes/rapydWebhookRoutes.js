const express = require("express");
const router = express.Router();
const FailedWebhook = require("../models/FailedWebhook");

router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    // 👉 Your actual Rapyd webhook processing logic goes here
    // Example: save to DB, update user balances, etc.
    // For now, assume it succeeds:
    console.log("Received webhook:", payload);

    return res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook processing failed:", err.message);

    // ❌ Save failed webhook for retry later
    await FailedWebhook.create({
      payload: req.body,
      endpoint: "/api/rapyd/webhook",
      error: err.message
    });

    return res.status(500).send("failed");
  }
});

module.exports = router;
