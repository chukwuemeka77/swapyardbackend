// utils/WalletService.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");

/**
 * Credit a wallet (add funds)
 * @param {String} userId - MongoDB _id of the user
 * @param {Number} amount - Amount to credit
 * @param {String} currency - Currency code (e.g., "USD")
 * @param {String} description - Transaction description
 */
async function creditWallet(userId, amount, currency, description = "Credit") {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // Ensure user has wallets object
  if (!user.wallets) user.wallets = {};
  if (!user.wallets[currency]) user.wallets[currency] = 0;

  // Update balance
  user.wallets[currency] += amount;
  await user.save();

  // Create transaction log
  const tx = new Transaction({
    userId,
    type: "credit",
    amount,
    currency,
    status: "pending", // will be updated by Rapyd webhook
    description,
  });
  await tx.save();

  return { balance: user.wallets[currency], transaction: tx };
}

/**
 * Debit a wallet (deduct funds if available)
 */
async function debitWallet(userId, amount, currency, description = "Debit") {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (!user.wallets || !user.wallets[currency] || user.wallets[currency] < amount) {
    throw new Error("Insufficient funds");
  }

  // Deduct balance
  user.wallets[currency] -= amount;
  await user.save();

  // Create transaction log
  const tx = new Transaction({
    userId,
    type: "debit",
    amount,
    currency,
    status: "pending", // will be updated by Rapyd webhook
    description,
  });
  await tx.save();

  return { balance: user.wallets[currency], transaction: tx };
}

module.exports = { creditWallet, debitWallet };
