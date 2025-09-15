// routes/admin.js
const express = require("express");
const { processFailedWebhooks } = require("../services/webhookRetryProcessor");
const router = express.Router();

router.post("/retry-failed-webhooks", async (req, res) => {
  try {
    await processFailedWebhooks(5);
    res.json({ message: "Retry triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
