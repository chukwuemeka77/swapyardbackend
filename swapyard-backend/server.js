// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
require("dotenv").config();

console.log("Access Key:", process.env.RAPYD_ACCESS_KEY);
console.log("Secret Key:", process.env.RAPYD_SECRET_KEY);

// ===== Routes =====
const userRoutes = require("./src/routes/userRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const countryRoutes = require("./src/routes/countryRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const notificationsRoutes = require("./src/routes/notificationRoutes");

// ===== Redis =====
const { connectRedis } = require("./src/services/redisClient");

// ===== App setup =====
const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());

// ===== MongoDB =====
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Redis =====
connectRedis().catch(err => console.error("❌ Redis connection failed:", err));

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/webhook/rapyd", rapydWebhookRoutes);
app.use("/api/notifications", notificationsRoutes);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
