const axios = require("axios");

async function sendPayout(bankAccount, amount, currency) {
  switch (bankAccount.provider) {
    case "rapyd":
      return await rapydPayout(bankAccount, amount, currency);
    case "paystack":
      return await paystackPayout(bankAccount, amount, currency);
    case "stripe":
      return await stripePayout(bankAccount, amount, currency);
    default:
      throw new Error("Unsupported bank provider");
  }
}

// Example: Rapyd payout
async function rapydPayout(bankAccount, amount, currency) {
  // dynamically use bankAccount.accountNumber, bankAccount.bankName, etc.
  const response = await axios.post(
    `${process.env.RAPYD_BASE_URL}/payouts`,
    {
      amount,
      currency,
      beneficiary: {
        type: "bank_account",
        account_number: bankAccount.accountNumber,
        name: bankAccount.accountHolder,
        bank_name: bankAccount.bankName,
        country: bankAccount.country,
      },
    },
    { headers: { Authorization: `Bearer ${process.env.RAPYD_SECRET_KEY}` } }
  );
  return response.data;
}

module.exports = { sendPayout };
