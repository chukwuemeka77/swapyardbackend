// src/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const redisClient = require("../utils/redisClient");
require("dotenv").config();

const router = express.Router();

// Helper: fetch Rapyd countries with caching
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
  await redisClient.setEx(cacheKey, 86400, JSON.stringify(countries));
  return countries;
}

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, identifier, password, country } = req.body;

    if (!identifier) return res.status(400).json({ error: "Email or phone is required" });

    // Fetch countries
    const countries = await getRapydCountries();
    const selectedCountry = countries.find(c => c.name.toLowerCase() === country.toLowerCase());
    if (!selectedCountry) return res.status(400).json({ error: "Country not supported" });
    const currency = selectedCountry.currency;

    // Check existing user
    const existingUser = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email: identifier.includes("@") ? identifier : null,
      phone: identifier.includes("@") ? null : identifier,
      passwordHash: hashedPassword,
      defaultCurrency: currency,
      defaultCountry: country,
    });
    await user.save();

    // Create non-KYC Rapyd wallet
    const walletResponse = await axios.post(
      "https://sandboxapi.rapyd.net/v1/wallets",
      {
        name,
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

    res.json({
      message: "Signup successful",
      user: { id: user._id, identifier, wallet_id: user.rapydId, currency: user.defaultCurrency },
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: "Identifier and password required" });

    const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "defaultsecret", { expiresIn: "7d" });

    res.json({ message: "Login successful", token, user: { id: user._id, name: user.name, identifier, currency: user.defaultCurrency } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
