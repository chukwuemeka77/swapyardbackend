import express from "express";
import auth from "../middleware/auth.js";
import { ensureUserWallet } from "../services/walletService.js"; // 👈 new import
import { rapydRequest } from "../services/rapydService.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

const router = express.Router();

/**
 * POST /api/users/register
 * Creates a new user and ensures a Rapyd wallet exists
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, preferredCurrency } = req.body;

    // ✅ Create user
    const user = await User.create({
      name,
      email,
      phone,
      password, // hash in pre-save hook
      currency: preferredCurrency || "USD",
    });

    // ✅ Create Rapyd wallet and local Wallet record
    const wallet = await ensureUserWallet(user);

    // ✅ Update user with Rapyd wallet ID
    user.rapydId = wallet.rapydWalletId;
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        wallet: {
          id: wallet._id,
          rapydWalletId: wallet.rapydWalletId,
          currency: wallet.currency,
          balance: wallet.balance,
        },
      },
    });
  } catch (err) {
    console.error("❌ Registration error:", err.response?.data || err.message);
    res.status(500).json({ error: "User registration failed" });
  }
});

/**
 * GET /api/users/me
 * Returns current user dashboard info
 */
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;
    const wallet = await Wallet.findOne({ userId: user._id });

    if (!wallet)
      return res.status(404).json({ error: "No wallet found for user" });

    // Optionally sync with Rapyd wallet
    const rapydWallet = await rapydRequest("GET", `/v1/user/${user.rapydId}/wallets`);
    const walletData = rapydWallet.data?.[0] || {};

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      currency: walletData.currency || wallet.currency,
      balance: walletData.balance || wallet.balance,
      walletId: wallet.rapydWalletId,
    });
  } catch (err) {
    console.error("Error in /me:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to load user data" });
  }
});

export default router;
