// src/routes/userRoutes.js
import express from "express";
import auth from "../middleware/auth.js";
import { rapydRequest } from "../services/rapydService.js";
import { ensureUserWallet } from "../services/walletService.js";
import Wallet from "../models/Wallet.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * ✅ GET /api/users/me
 * Fetch user dashboard, wallet & transactions
 */
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;

    // Ensure wallet exists (creates one if missing)
    const wallet = await ensureUserWallet(user);

    // Fetch wallet info from Rapyd
    const walletRes = await rapydRequest("GET", `/v1/user/${user.rapydId}/wallets`);
    const wallets = walletRes.data || [];
    if (!wallets.length) return res.status(404).json({ error: "No wallet found for user" });

    const rapydWallet = wallets[0];

    // Fetch transactions from Rapyd
    const txRes = await rapydRequest("GET", `/v1/wallets/${rapydWallet.id}/transactions`);
    const transactions = txRes.data || [];

    // Optional: sync wallet balance locally
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { balance: rapydWallet.balance },
      { new: true }
    );

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      currency: rapydWallet.currency,
      balance: rapydWallet.balance,
      walletId: rapydWallet.id,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        description: tx.description || tx.type,
        created_at: tx.created_at,
      })),
    });
  } catch (err) {
    console.error("❌ Error in /me:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to load user dashboard" });
  }
});

/**
 * ✅ POST /api/users/register
 * Register user and create Rapyd wallet automatically
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, preferredCurrency } = req.body;

    const user = await User.create({
      name,
      email,
      phone,
      password, // hashed via pre-save
      currency: preferredCurrency || "USD",
    });

    // Create Rapyd wallet
    const wallet = await ensureUserWallet(user);
    user.rapydId = wallet.rapydWalletId;
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        walletId: wallet.rapydWalletId,
        currency: wallet.currency,
      },
    });
  } catch (err) {
    console.error("❌ Registration error:", err.response?.data || err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

export default router;
