const mongoose = require("mongoose");

const failedWebhookSchema = new mongoose.Schema({
  payload: { type: Object, required: true },   // raw webhook JSON
  endpoint: { type: String, required: true },  // e.g., /api/rapyd/webhook
  error: { type: String },                     // error message from last attempt
  retries: { type: Number, default: 0 },       // retry count
  nextRetryAt: { type: Date, default: Date.now } // when to retry next
}, { timestamps: true });

module.exports = mongoose.model("FailedWebhook", failedWebhookSchema);
