// src/routes/user.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { rapydRequest } = require("../utils/rapyd");

// GET /api/users/me
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user; // added by auth middleware

    // ✅ Fetch wallets
    const walletRes = await rapydRequest("GET", `/user/${user.rapydId}/wallets`);
    const wallets = walletRes.data || [];

    if (!wallets.length) {
      return res.status(404).json({ error: "No wallet found for user" });
    }

    const wallet = wallets[0]; // primary wallet

    // ✅ Fetch transactions
    const txRes = await rapydRequest("GET", `/wallets/${wallet.id}/transactions`);
    const transactions = txRes.data || [];

    res.json({
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
    });
  } catch (err) {
    console.error("Error in /me:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

module.exports = router;
