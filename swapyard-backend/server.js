// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { connectRabbitMQ } = require("./src/services/rabbitmqService");

// Load env variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// ---------------- MongoDB ----------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ---------------- RabbitMQ ----------------
connectRabbitMQ();

// ---------------- Routes ----------------
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const adminRoutes = require("./src/routes/adminRoutes"); // analytics, monitoring, etc.

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/webhook", rapydWebhookRoutes);
app.use("/api/admin", adminRoutes);

// ---------------- Workers ----------------
// Just require them to start consuming queues
require("./src/workers/depositWorker");
require("./src/workers/withdrawalWorker");
require("./src/workers/paymentWorker");
require("./src/workers/exchangeWorker");
require("./src/workers/recurringWorker"); // includes mandatory markup transfer to Swapyard wallet

// ---------------- Start server ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
