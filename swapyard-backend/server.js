// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const helmet = require("helmet");

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"],   // ✅ allow bootstrap icons css
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],    // ✅ allow bootstrap icons fonts
    },
  })
);

const authRoutes = require("./src/routes/auth");   // 👈 adjust path
const protectedAuthRoutes = require("./src/middleware/auth");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);          // signup/login
app.use("/api/auth", protectedAuthRoutes); // me/preferences

// DB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
