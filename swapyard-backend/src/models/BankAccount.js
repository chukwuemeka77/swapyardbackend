// src/models/BankAccount.js
const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    currency: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BankAccount", bankAccountSchema);
