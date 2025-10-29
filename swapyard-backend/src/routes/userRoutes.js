// src/routes/userRoutes.js
import express from "express";
import auth from "../middleware/auth.js";
import { rapydRequest } from "../utils/rapyd.js";

const router = express.Router();

// GET /api/users/me
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user; // added by auth middleware

    if (!user.rapydId) {
      return res.status(400).json({ error: "User has no associated Rapyd ID" });
    }

    // ✅ Fetch wallets from Rapyd
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
      phone: user.phone,
      balances: wallet.balance,
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

export default router;
