// models/WebhookLog.js
const mongoose = require("mongoose");

const webhookLogSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true }, // e.g. PAYMENT_COMPLETED, TRANSFER_FAILED
    rapydEventId: { type: String }, // Rapyd's unique ID for the event
    rawData: { type: mongoose.Schema.Types.Mixed, required: true }, // full Rapyd payload

    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: false
    },

    status: {
      type: String,
      enum: ["received", "processed", "failed"],
      default: "received"
    },

    errorMessage: { type: String }, // if something went wrong in processing
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebhookLog", webhookLogSchema);
