// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

// ===== Initialize app FIRST =====
const app = express();

// ===== Middleware =====
helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
    styleSrc: ["'self'", "https://cdn.jsdelivr.net"],
    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
  },
});


app.use(cors());
app.use(express.json());

// ===== Routes =====
const authRoutes = require("./src/routes/auth.js");
const authMiddleware = require("./src/middleware/auth.js");

app.use("/api/auth", authRoutes);
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ===== Database Connection =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

