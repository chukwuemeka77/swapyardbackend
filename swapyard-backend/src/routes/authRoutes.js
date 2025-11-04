// src/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ensureUserWallet } = require("../services/walletService"); // utility to create/fetch Rapyd wallet
const auth = require("../middleware/auth");
require("dotenv").config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// ==================== REGISTER ====================
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, currency } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: "Email or phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      currency,
    });

    // Create Rapyd wallet
    const wallet = await ensureUserWallet(user);

    // Return token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        walletId: wallet.rapydWalletId,
        currency: wallet.currency,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = email or phone

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // Ensure wallet exists
    const wallet = await ensureUserWallet(user);

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        walletId: wallet.rapydWalletId,
        currency: wallet.currency,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ==================== GET CURRENT USER ====================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const wallet = await ensureUserWallet(user);

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      walletId: wallet.rapydWalletId,
      currency: wallet.currency,
    });
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
