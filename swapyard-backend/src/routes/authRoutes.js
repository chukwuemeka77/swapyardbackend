// src/routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import User from "../models/User.js";
import redisClient from "../services/redisClient.js";

dotenv.config();

const router = express.Router();

// Helper: fetch Rapyd countries (cached)
async function getRapydCountries() {
  const cacheKey = "rapyd_countries";
  const cached = await redisClient.get(cacheKey);
  if (cached) return cached;

  const response = await axios.get("https://sandboxapi.rapyd.net/v1/data/countries", {
    headers: {
      access_key: process.env.RAPYD_API_KEY,
      secret_key: process.env.RAPYD_SECRET_KEY,
    },
  });

  const countries = response.data.data;
  await redisClient.set(cacheKey, countries, 86400); // cache 24h
  return countries;
}

// ==================== SIGNUP ====================
router.post("/signup", async (req, res) => {
  try {
    const { name, identifier, password, country } = req.body;

    if (!name || !password || !identifier)
      return res.status(400).json({ error: "Name, password, and email or phone are required" });

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: identifier.includes("@") ? identifier : null }, { phone: !identifier.includes("@") ? identifier : null }],
    });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Fetch countries
    const countries = await getRapydCountries();
    const selectedCountry = countries.find(c => c.name.toLowerCase() === country.toLowerCase());
    if (!selectedCountry) return res.status(400).json({ error: "Country not supported" });

    const defaultCurrency = selectedCountry.currency;

    // Create user
    const user = new User({
      name,
      email: identifier.includes("@") ? identifier : null,
      phone: identifier.includes("@") ? null : identifier,
      passwordHash,
      defaultCountry: selectedCountry.name,
      defaultCurrency,
    });
    await user.save();

    // Create non-KYC wallet in Rapyd
    const walletResponse = await axios.post(
      "https://sandboxapi.rapyd.net/v1/wallets",
      {
        name,
        currency: defaultCurrency,
        type: "personal",
        ewallet_reference_id: user._id.toString(),
        metadata: { identifier, country },
      },
      { headers: { access_key: process.env.RAPYD_API_KEY, secret_key: process.env.RAPYD_SECRET_KEY } }
    );

    user.walletId = walletResponse.data.data.id;
    await user.save();

    res.status(201).json({
      message: "Signup successful",
      user: {
        id: user._id,
        identifier,
        walletId: user.walletId,
        currency: user.defaultCurrency,
      },
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password)
      return res.status(400).json({ error: "Email/phone and password are required" });

    // Find user
    const user = await User.findOne({
      $or: [{ email: identifier.includes("@") ? identifier : null }, { phone: !identifier.includes("@") ? identifier : null }],
    });
    if (!user) return res.status(400).json({ error: "User not found" });

    // Check password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(400).json({ error: "Invalid credentials" });

    // JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "defaultsecret", { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

export default router;
