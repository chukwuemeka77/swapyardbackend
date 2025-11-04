// src/routes/userRoutes.js
const express = require("express");
const auth = require("../middleware/auth");
const { rapydRequest } = require("../services/rapydService");

const router = express.Router();

// ---------------- Dashboard / Me ----------------
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.rapydWalletId) {
      return res.status(400).json({ error: "User has no associated Rapyd wallet" });
    }

    // Fetch wallet info from Rapyd
    const walletRes = await rapydRequest("GET", `/wallets/${user.rapydWalletId}`);
    const wallet = walletRes.data;

    // Fetch transactions
    const txRes = await rapydRequest("GET", `/wallets/${user.rapydWalletId}/transactions`);
    const transactions = txRes.data || [];

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      balances: wallet.balance,
      currency: wallet.currency,
      transactions: transactions.map(tx => ({
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
