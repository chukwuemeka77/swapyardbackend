
// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

const app = express();

// ===== Middleware =====

// Helmet for security headers, including Content Security Policy
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"],   // ✅ allow external CSS
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],    // ✅ allow external fonts
    },
  })
);

// CORS
app.use(cors());

// JSON parsing
app.use(express.json());

// ===== Routes =====
const authRoutes = require("./src/routes/auth");           // Auth router
const authMiddleware = require("./src/middleware/auth");   // Middleware for protected routes

// Public routes
app.use("/api/auth", authRoutes);

// Example protected route
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user }); // middleware should attach req.user
});

// ===== Database Connection =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
