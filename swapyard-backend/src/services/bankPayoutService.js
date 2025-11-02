const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const RAPYD_BASE_URL = process.env.RAPYD_BASE_URL;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;
const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;

// ✅ Send payout via Rapyd
async function sendRapydPayout(bankAccount, amount, currency, referenceId) {
  try {
    const body = {
      beneficiary: {
        name: bankAccount.accountHolder,
        account_number: bankAccount.accountNumber,
        country: bankAccount.country,
        currency: currency,
      },
      amount: amount,
      currency: currency,
      reference_id: referenceId,
      metadata: {
        userId: bankAccount.userId.toString(),
      },
    };

    const response = await axios.post(
      `${RAPYD_BASE_URL}/v1/payouts`,
      body,
      {
        headers: {
          "access_key": RAPYD_ACCESS_KEY,
          "secret_key": RAPYD_SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err) {
    console.error("❌ Rapyd payout failed:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendRapydPayout };
