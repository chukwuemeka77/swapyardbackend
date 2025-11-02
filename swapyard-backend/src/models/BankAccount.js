const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountHolder: { type: String, required: true },
  country: { type: String, required: true },
  provider: { type: String, enum: ["rapyd"], default: "rapyd" },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("BankAccount", bankAccountSchema);
