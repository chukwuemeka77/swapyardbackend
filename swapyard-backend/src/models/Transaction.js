// models/Transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer", "payment", "fx_exchange"],
      required: true
    },

    amount: { type: Number, required: true },
    currency: { type: String, required: true }, // e.g. "USD", "NGN"

    // For FX conversions
    fromCurrency: String,
    toCurrency: String,
    exchangeRate: Number,

    // For transfers/payments
    counterparty: { type: String }, // could be email, phone, userId, or walletId
    referenceId: { type: String, unique: true }, // idempotency (Rapyd style)

    status: {
      type: String,
      enum: ["pending", "success", "failed", "reversed"],
      default: "pending"
    },

    description: String,

    // Optional metadata
    metadata: { type: mongoose.Schema.Types.Mixed },

    // ✅ Store the raw Rapyd webhook event for auditing/debugging
    rawRapydEvent: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
