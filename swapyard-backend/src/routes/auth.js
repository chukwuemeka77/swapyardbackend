// auth.js (Express Router example)
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); // if you're hashing passwords
const User = require("../models/User"); // your mongoose/sequelize User model
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // keep safe in .env

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email }, // payload
      JWT_SECRET,
      { expiresIn: "7d" } // token expiry
    );

    // Send response
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

