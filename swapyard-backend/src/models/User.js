// src/models/User.js
import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["card", "bank_account", "crypto"], required: true },
    provider: String,
    last4: String,
    token: String,
    expiry: String,
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const walletBalanceSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },

    // Wallet
    balances: [walletBalanceSchema],
    defaultCurrency: { type: String, default: "USD" },
    defaultCountry: { type: String, default: "US" },
    rapydId: { type: String }, // store Rapyd wallet owner ID

    // Payment Methods
    paymentMethods: [paymentMethodSchema],

    // KYC
    kycVerified: { type: Boolean, default: false },
    kycLevel: { type: String, enum: ["basic", "advanced"], default: "basic" },
    documents: [{ type: { type: String }, url: String, verified: { type: Boolean, default: false } }],

    // Transactions
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
