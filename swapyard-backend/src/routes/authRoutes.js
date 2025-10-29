// swapyard-backend/src/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const redisClient = require("../services/redisClient");
require("dotenv").config();

const router = express.Router();

// ==================== HELPER: FETCH RAPYD COUNTRIES ====================
async function getRapydCountries() {
  const cacheKey = "rapyd_countries";
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const response = await axios.get("https://sandboxapi.rapyd.net/v1/data/countries", {
    headers: {
      access_key: process.env.RAPYD_API_KEY,
      secret_key: process.env.RAPYD_SECRET_KEY,
    },
  });

  const countries = response.data.data;
  await redisClient.setEx(cacheKey, 86400, JSON.stringify(countries)); // cache for 24h
  return countries;
}

// ==================== SIGNUP ====================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password, country } = req.body;

    // Validate required fields
    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({
        error: "Name, password, and email or phone are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Fetch countries and determine default currency
    const countries = await getRapydCountries();
    const selectedCountry = countries.find(
      (c) => c.name.toLowerCase() === country.toLowerCase()
    );
    if (!selectedCountry) return res.status(400).json({ error: "Country not supported" });
    const currency = selectedCountry.currency;

    // Create new user in MongoDB
    const newUser = new User({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashedPassword,
      country,
      currency,
    });

    await newUser.save();

    // Create non-KYC wallet in Rapyd
    const walletResponse = await axios.post(
      "https://sandboxapi.rapyd.net/v1/wallets",
      {
        name,
        currency,
        type: "personal",
        ewallet_reference_id: newUser._id.toString(),
        metadata: { email, phone, country },
      },
      {
        headers: {
          access_key: process.env.RAPYD_API_KEY,
          secret_key: process.env.RAPYD_SECRET_KEY,
        },
      }
    );

    // Save wallet ID
    newUser.wallet_id = walletResponse.data.data.id;
    await newUser.save();

    res.status(201).json({
      message: "Signup successful! Wallet created.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        wallet_id: newUser.wallet_id,
        currency: newUser.currency,
      },
    });
  } catch (err) {
    console.error("Signup error:", err.response?.data || err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Validate fields
    if ((!email && !phone) || !password) {
      return res
        .status(400)
        .json({ error: "Email/phone and password are required" });
    }

    // Find user in DB
    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        wallet_id: user.wallet_id,
        currency: user.currency,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;
