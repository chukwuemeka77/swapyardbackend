// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { connectRabbitMQ } = require("./src/services/rabbitmqService");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// ==================== MongoDB Connection ====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ==================== RabbitMQ Connection ====================
connectRabbitMQ();

// ==================== Routes ====================
const userRoutes = require("./src/routes/userRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const exchangeRoutes = require("./src/routes/exchangeRoutes"); // ✅ newly added
const notificationRoutes = require("./src/routes/notificationRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const healthRoutes = require("./src/routes/healthRoutes");

// mount all
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/exchange", exchangeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/webhook", rapydWebhookRoutes);
app.use("/api/health", healthRoutes);

// ==================== Start Server ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
