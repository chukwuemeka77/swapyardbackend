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

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// RabbitMQ connection
connectRabbitMQ();

// Routes
const userRoutes = require("./src/routes/userRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");

app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/webhook", rapydWebhookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
