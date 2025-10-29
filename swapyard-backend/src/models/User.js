// src/models/User.js
import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["card", "bank_account", "crypto"],
      required: true,
    },
    provider: String, // e.g., VISA, MasterCard, Bank name
    last4: String, // last 4 digits of card/account
    token: String, // payment method token
    expiry: String, // MM/YY for cards
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const walletBalanceSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true }, // e.g., "USD", "NGN"
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Basic Identity
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },

    // Wallet
    wallet_id: { type: String }, // Rapyd wallet ID ✅
    balances: [walletBalanceSchema], // multi-currency wallet
    defaultCurrency: { type: String, default: "USD" }, // auto-set from country
    defaultCountry: { type: String, default: "US" },

    // Payment Methods
    paymentMethods: [paymentMethodSchema],

    // KYC / Compliance
    kycVerified: { type: Boolean, default: false },
    kycLevel: {
      type: String,
      enum: ["basic", "advanced"],
      default: "basic",
    },
    documents: [
      {
        type: { type: String }, // e.g., passport, ID_card
        url: String,
        verified: { type: Boolean, default: false },
      },
    ],

    // Transactions (references)
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
