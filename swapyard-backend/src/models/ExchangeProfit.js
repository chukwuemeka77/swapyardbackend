// src/models/ExchangeProfit.js
const mongoose = require("mongoose");

const exchangeProfitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pair: { type: String, required: true },
    amount: { type: Number, required: true },             // original amount (from currency)
    convertedAmount: { type: Number, required: true },    // amount credited to user (to currency)
    baseRate: { type: Number, required: true },
    effectiveRate: { type: Number, required: true },
    markupPercent: { type: Number, required: true },
    profitEarned: { type: Number, required: true },
    transactionId: { type: String }, // optional link to transaction
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExchangeProfit", exchangeProfitSchema);
