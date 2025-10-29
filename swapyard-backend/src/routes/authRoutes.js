const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const redisClient = require("../services/redisClient");

require("dotenv").config();

// ==================== Helper: fetch Rapyd countries with Redis caching ====================
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

    // Validate required fields
    if (!name || !password || !identifier) {
      return res.status(400).json({ error: "Name, password, and email or phone are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: identifier.includes("@") ? identifier : null }, { phone: !identifier.includes("@") ? identifier : null }],
    });

    if (existingUser) return res.status(400).json({ error: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Fetch countries from Rapyd
    const countries = await getRapydCountries();

    // Determine default currency
    const selectedCountry = countries.find(
      (c) => c.name.toLowerCase() === country.toLowerCase()
    );
    if (!selectedCountry) return res.status(400).json({ error: "Country not supported" });
    const currency = selectedCountry.currency;

    // Create user
    const user = new User({
      name,
      email: identifier.includes("@") ? identifier : null,
      phone: identifier.includes("@") ? null : identifier,
      passwordHash: hashedPassword,
      defaultCountry: country,
      defaultCurrency: currency,
      balances: [{ currency, amount: 0 }],
    });
    await user.save();

    // Create Rapyd wallet (non-KYC)
    const walletResponse = await axios.post(
      "https://sandboxapi.rapyd.net/v1/wallets",
      {
        name: name,
        currency,
        type: "personal",
        ewallet_reference_id: user._id.toString(),
        metadata: { identifier, country },
      },
      {
        headers: {
          access_key: process.env.RAPYD_API_KEY,
          secret_key: process.env.RAPYD_SECRET_KEY,
        },
      }
    );

    user.rapydId = walletResponse.data.data.id;
    await user.save();

    res.status(201).json({
      message: "Signup successful",
      user: {
        id: user._id,
        identifier,
        wallet_id: user.rapydId,
        currency: user.defaultCurrency,
      },
    });
  } catch (err) {
    console.error("Signup error:", err.response?.data || err);
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
      $or: [
        { email: identifier.includes("@") ? identifier : null },
        { phone: !identifier.includes("@") ? identifier : null },
      ],
    });

    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    // JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "defaultsecret", {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        identifier: user.email || user.phone,
        wallet_id: user.rapydId,
        currency: user.defaultCurrency,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;
