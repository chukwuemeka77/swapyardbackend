const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    bankAccountId: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    markupPercent: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true }, // after markup
    transactionId: { type: String }, // Rapyd payout id
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
