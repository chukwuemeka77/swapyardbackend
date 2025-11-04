// src/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ensureUserWallet } = require("../services/walletService");

const router = express.Router();

// ---------------- Register ----------------
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, currency } = req.body;

    // Check if user exists
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, password: hashed, currency });

    // Ensure Rapyd wallet creation
    const wallet = await ensureUserWallet(user);

    // JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ success: true, token, user: { id: user._id, name, email, phone, currency } });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// ---------------- Login ----------------
router.post("/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const user = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] });
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, currency: user.currency } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

module.exports = router;
