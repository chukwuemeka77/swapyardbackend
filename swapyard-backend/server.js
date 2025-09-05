// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

// ===== Initialize app FIRST =====
const app = express();

// ===== Middleware =====
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"], // allow bootstrap icons
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],  // allow fonts
    },
  })
);

app.use(cors());
app.use(express.json());

// ===== Routes =====
const authRoutes = require("./src/routes/auth");
const authMiddleware = require("./src/middleware/auth");

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

