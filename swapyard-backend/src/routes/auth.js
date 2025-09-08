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
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(500).json({ message: "User password is missing in DB" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ message: "Login successful" });
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

