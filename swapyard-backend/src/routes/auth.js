const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // must export Mongoose model

const router = express.Router();

// ==================== SIGNUP ====================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

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

    // Create new user
    const newUser = new User({
      name,
      email,
      phone,
      passwordHash: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "Signup successful! Please login.",
    });
  } catch (err) {
    console.error("Signup error:", err);
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
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;
