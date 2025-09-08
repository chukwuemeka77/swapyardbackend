const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
require("dotenv").config();

// ===== Initialize app FIRST =====
const app = express();
const countryRoutes = require("./src/routes/countries");

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  })
);

// ===== Routes =====
const authRoutes = require("./src/routes/auth.js");
const userRoutes = require("./src/routes/user.js");
const authMiddleware = require("./src/middleware/auth.js");
app.use("/api/countries", countryRoutes);// countries selection

app.use("/api/auth", authRoutes);   // signup, login
app.use("/api/user", userRoutes);   // profile, preferences

// Quick check endpoint
app.get("/", (req, res) => {
  res.send("API is running...");
});

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
