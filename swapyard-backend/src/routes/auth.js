// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");   // ✅ NEW
const User = require("../models/User");

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, phone, password, name } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: "Email or phone is required" });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      email,
      phone,
      passwordHash,
      name,
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ error: "Email/phone and password required" });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || "defaultsecret", 
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,  // ✅ send token to client
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
