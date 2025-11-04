// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// Rate limiter (optional global) - small wrapper you created
const createRateLimiter = require("./src/middleware/rateLimiter");
app.use(createRateLimiter({ windowMs: 60 * 1000, max: 200 }));

// ====== Connect MongoDB ======
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message || err);
    process.exit(1);
  });

// ====== Connect RabbitMQ (if you have connect function) ======
try {
  const { connectRabbitMQ } = require("./src/services/rabbitmqService");
  if (typeof connectRabbitMQ === "function") {
    connectRabbitMQ().catch((e) => console.error("RabbitMQ connection error:", e));
  }
} catch (err) {
  console.warn("⚠️ rabbitmqService not available or already wired:", err.message || err);
}

// ====== Routes ======
const userRoutes = require("./src/routes/userRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const recurringRoutes = require("./src/routes/recurringRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes"); // keep if exists

app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/webhook", rapydWebhookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);

// ====== Start recurring scheduler (cron) ======
// If you prefer this to run as a separate background worker, remove this require
// and run `node src/services/recurringScheduler.js` in Render as a background service.
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
