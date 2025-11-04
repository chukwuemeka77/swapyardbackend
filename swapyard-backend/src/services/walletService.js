const { rapydRequest } = require("./rapydService");
const Wallet = require("../models/Wallet");

async function ensureUserWallet(user) {
  // Prefer user's currency, otherwise default to USD
  const userCurrency = user.currency || user.preferredCurrency || "USD";

  let wallet = await Wallet.findOne({ userId: user._id });
  if (wallet) return wallet;

  // Create Rapyd wallet
  const body = {
    first_name: user.firstName || "User",
    last_name: user.lastName || "Unknown",
    ewallet_reference_id: `swapyard_${user._id}`,
    metadata: { userId: user._id.toString(), currency: userCurrency },
  };

  const response = await rapydRequest("post", "/v1/user", body);
  const rapydWalletId = response.data.id;

  wallet = await Wallet.create({
    userId: user._id,
    currency: userCurrency,
    balance: 0,
    rapydWalletId,
  });

  return wallet;
}

module.exports = { ensureUserWallet };
