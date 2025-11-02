// src/services/bankPayoutService.js
const axios = require("axios");
const BankAccount = require("../models/BankAccount");

const RAPYD_BASE_URL = process.env.RAPYD_BASE_URL; // e.g., https://sandboxapi.rapyd.net
const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;

// Helper to generate Rapyd signature
function generateRapydSignature(httpMethod, urlPath, body = "") {
  const crypto = require("crypto");
  const salt = crypto.randomBytes(12).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);

  const toSign = `${httpMethod}${urlPath}${salt}${timestamp}${RAPYD_ACCESS_KEY}${RAPYD_SECRET_KEY}${body}`;
  const signature = crypto.createHash("sha256").update(toSign).digest("base64");

  return { signature, salt, timestamp };
}

// Fetch supported banks for a country
async function getSupportedBanks(country) {
  const urlPath = `/v1/kyc/banks?country=${country}`;
  const { signature, salt, timestamp } = generateRapydSignature("GET", urlPath);

  const res = await axios.get(RAPYD_BASE_URL + urlPath, {
    headers: {
      access_key: RAPYD_ACCESS_KEY,
      salt,
      timestamp,
      signature,
      "Content-Type": "application/json",
    },
  });

  return res.data.data || [];
}

// Initiate payout to a bank account
async function payoutToBank(bankAccountId, amount, currency) {
  const bankAccount = await BankAccount.findById(bankAccountId);
  if (!bankAccount) throw new Error("Bank account not found");

  const urlPath = "/v1/account/payouts";
  const body = JSON.stringify({
    beneficiary: {
      type: "bank_account",
      name: bankAccount.accountHolder,
      account_number: bankAccount.accountNumber,
      country: bankAccount.country,
      currency: currency,
      bank_name: bankAccount.bankName,
    },
    amount,
    currency,
    metadata: {
      userId: bankAccount.userId.toString(),
      bankAccountId: bankAccount._id.toString(),
    },
  });

  const { signature, salt, timestamp } = generateRapydSignature("POST", urlPath, body);

  const res = await axios.post(RAPYD_BASE_URL + urlPath, body, {
    headers: {
      access_key: RAPYD_ACCESS_KEY,
      salt,
      timestamp,
      signature,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

// Optionally: fetch deposit from bank (for supported countries)
async function fetchDepositFromBank(bankAccountId, amount, currency) {
  const bankAccount = await BankAccount.findById(bankAccountId);
  if (!bankAccount) throw new Error("Bank account not found");

  const urlPath = "/v1/account/collect";
  const body = JSON.stringify({
    source: {
      type: "bank_account",
      name: bankAccount.accountHolder,
      account_number: bankAccount.accountNumber,
      country: bankAccount.country,
      currency,
      bank_name: bankAccount.bankName,
    },
    amount,
    currency,
    metadata: {
      userId: bankAccount.userId.toString(),
      bankAccountId: bankAccount._id.toString(),
    },
  });

  const { signature, salt, timestamp } = generateRapydSignature("POST", urlPath, body);

  const res = await axios.post(RAPYD_BASE_URL + urlPath, body, {
    headers: {
      access_key: RAPYD_ACCESS_KEY,
      salt,
      timestamp,
      signature,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

module.exports = {
  getSupportedBanks,
  payoutToBank,
  fetchDepositFromBank,
};
