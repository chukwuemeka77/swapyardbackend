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
    const { email, password } = req.body;

    // Check request body
    if (!email || !password) {
      console.error("Missing email or password in request body:", req.body);
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      console.error("User not found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has password field
    if (!user.password) {
      console.error("User has no password field in DB:", user);
      return res.status(500).json({ message: "User password missing in DB" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({ message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

