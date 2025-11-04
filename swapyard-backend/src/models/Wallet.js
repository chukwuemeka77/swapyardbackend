// src/models/Wallet.js
const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, required: true },
  rapydEwalletId: { type: String, required: true }, // ✅ direct Rapyd wallet link
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Wallet", walletSchema);
