// src/services/webhooks/webhookRetryProcessor.js
const FailedWebhook = require("../models/FailedWebhook");
const axios = require("axios");

async function processFailedWebhooks(batchSize = 5) {
  const now = new Date();

  // Pick a few failed webhooks that are ready for retry
  const failedWebhooks = await FailedWebhook.find({
    nextRetryAt: { $lte: now }
  }).limit(batchSize);

  for (const webhook of failedWebhooks) {
    try {
      console.log(`Retrying webhook ${webhook._id} -> ${webhook.endpoint}`);

      // Re-send payload to your own API endpoint
      await axios.post(
        `${process.env.BASE_URL}${webhook.endpoint}`,
        webhook.payload,
        { headers: { "Content-Type": "application/json" } }
      );

      // ✅ Success → remove from DB
      await FailedWebhook.findByIdAndDelete(webhook._id);
      console.log(`Webhook ${webhook._id} processed successfully`);
    } catch (err) {
      // ❌ Failed again → update retry info
      webhook.retries += 1;

      // Exponential backoff (2^retries minutes)
      const delayMinutes = Math.pow(2, webhook.retries);
      webhook.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      webhook.error = err.message;

      await webhook.save();
      console.error(
        `Webhook ${webhook._id} failed again, retry in ${delayMinutes}m`
      );
    }
  }
}

module.exports = { processFailedWebhooks };
