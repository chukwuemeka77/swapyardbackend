// models/WebhookLog.js
const mongoose = require("mongoose");

const webhookLogSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true },
    rapydEventId: { type: String },
    rawData: { type: mongoose.Schema.Types.Mixed, required: true },

    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    status: {
      type: String,
      enum: ["received", "processed", "failed", "ignored"],
      default: "received",
    },

    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },   // 🔹 new field
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebhookLog", webhookLogSchema);

