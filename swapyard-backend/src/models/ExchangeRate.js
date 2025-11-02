// src/models/ExchangeRate.js
const mongoose = require("mongoose");

const exchangeRateSchema = new mongoose.Schema(
  {
    pair: { type: String, required: true, unique: true }, // e.g. "USD_NGN"
    rate: { type: Number, required: true },               // base market rate
    markupPercent: { type: Number, default: null },       // e.g. 0.02 (2%) - null => use env default
    active: { type: Boolean, default: true },
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExchangeRate", exchangeRateSchema);
