// src/routes/user.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const axios = require("axios");
const redisClient = require("../utils/redisClient");

const RAPYD_API_KEY = process.env.RAPYD_API_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;

// Helper to make Rapyd requests
async function rapydRequest(method, path, data = null) {
  const url = `https://sandboxapi.rapyd.net/v1${path}`;
  const options = {
    method,
    url,
    headers: { access_key: RAPYD_API_KEY, secret_key: RAPYD_SECRET_KEY },
    data,
  };
  const response = await axios(options);
  return response.data;
}

// GET /api/users/me
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user; // from auth middleware
    const cacheKey = `user_wallets:${user._id}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Fetch wallets from Rapyd
    const walletRes = await rapydRequest("GET", `/user/${user.rapydId}/wallets`);
    const wallets = walletRes.data || [];

    if (!wallets.length) {
      return res.status(404).json({ error: "No wallet found for user" });
    }

    const wallet = wallets[0]; // primary wallet

    // Fetch transactions
    const txRes = await rapydRequest("GET", `/wallets/${wallet.id}/transactions`);
    const transactions = txRes.data || [];

    const responseData = {
      name: user.name,
      email: user.email,
      balance: wallet.balance,
      currency: wallet.currency,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description || tx.type,
        created_at: tx.created_at,
      })),
    };

    // Cache result for 10 minutes
    await redisClient.setEx(cacheKey, 600, JSON.stringify(responseData));

    res.json(responseData);
  } catch (err) {
    console.error("Error in /me:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

module.exports = router;
