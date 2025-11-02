// src/models/RecurringPayment.js
const mongoose = require("mongoose");

const recurringPaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  interval: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  nextRun: { type: Date, required: true },
  active: { type: Boolean, default: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("RecurringPayment", recurringPaymentSchema);
