// src/models/RecurringPayment.js
const mongoose = require("mongoose");

const recurringPaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  schedule: { type: String, required: true }, // e.g., cron expression or interval
  nextRun: { type: Date, required: true },
  status: { type: String, enum: ["active", "paused", "stopped"], default: "active" },
  markupPercent: { type: Number, default: 0 }, // dynamically fetched from markupSettings
}, { timestamps: true });

module.exports = mongoose.model("RecurringPayment", recurringPaymentSchema);
