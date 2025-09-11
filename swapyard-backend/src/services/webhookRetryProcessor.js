// services/webhookRetryProcessor.js
const WebhookLog = require("../models/WebhookLog");
const Transaction = require("../models/Transaction");

async function processFailedWebhooks(maxRetries = 5) {
  const failedLogs = await WebhookLog.find({
    status: "failed",
    retryCount: { $lt: maxRetries },
  }).limit(10); // batch to avoid overload

  for (const log of failedLogs) {
    try {
      const event = log.rawData || {};
      const data = event.data || {};

      const txFields = {
        referenceId: data.id,
        type: mapRapydEventToType(event.type),
        amount: data.amount,
        currency: data.currency,
        status: mapRapydStatus(event.type),
        description: data.description || `Rapyd ${event.type}`,
        metadata: data,
      };

      const transaction = await Transaction.findOneAndUpdate(
        { referenceId: data.id },
        txFields,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      log.relatedTransaction = transaction._id;
      log.status = "processed";
      log.errorMessage = null;
      log.retryCount += 1;
      await log.save();

      console.log(`✅ Retried webhook ${log._id} successfully`);
    } catch (err) {
      log.retryCount += 1;
      log.errorMessage = err.message;
      await log.save();
      console.error(`❌ Retry failed for webhook ${log._id}:`, err.message);
    }
  }
}

// Reuse your mapping helpers
function mapRapydEventToType(eventType) {
  switch (eventType) {
    case "payment.completed":
    case "payment.failed":
      return "deposit";
    case "transfer.completed":
    case "transfer.failed":
      return "transfer";
    case "wallet.transaction":
      return "payment";
    default:
      return "payment";
  }
}

function mapRapydStatus(eventType) {
  if (eventType.includes("failed")) return "failed";
  if (eventType.includes("completed")) return "success";
  return "pending";
}

module.exports = { processFailedWebhooks };
