// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

// optional: increase Node's event listeners if you have many SSE clients
require("events").defaultMaxListeners = 50;

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// rate limiter (optional)
try {
  const createRateLimiter = require("./src/middleware/rateLimiter");
  app.use(createRateLimiter({ windowMs: 60 * 1000, max: 200 }));
} catch (e) {
  console.warn("Rate limiter not applied:", e.message || e);
}

// ====== Connect MongoDB ======
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message || err);
    process.exit(1);
  });

// ====== Connect RabbitMQ (optional) ======
try {
  const { connectRabbitMQ } = require("./src/services/rabbitmqService");
  if (typeof connectRabbitMQ === "function") {
    connectRabbitMQ().catch((e) => console.error("RabbitMQ connection error:", e));
  }
} catch (err) {
  console.warn("⚠️ rabbitmqService not loaded:", err.message || err);
}

// ====== Mount existing routes ======
const userRoutes = require("./src/routes/userRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const recurringRoutes = require("./src/routes/recurringRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const adminAnalyticsRoutes = require("./src/routes/adminAnalytics");

app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/webhook", rapydWebhookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);

// ====== Start recurring scheduler (node-cron) ======
// If you prefer to run scheduler as a separate process, remove this require
try {
  require("./src/services/recurringScheduler");
  console.log("🕒 Recurring scheduler loaded");
} catch (err) {
  console.warn("⚠️ Could not start recurring scheduler in this process:", err.message || err);
}

// ====== Health check ======
app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
