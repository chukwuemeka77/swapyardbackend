// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

console.log("Access Key:", process.env.RAPYD_ACCESS_KEY);
console.log("Secret Key:", process.env.RAPYD_SECRET_KEY);

import userRoutes from "./src/routes/userRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import countryRoutes from "./src/routes/countryRoutes.js";
import healthRoutes from "./src/routes/healthRoutes.js";
import rapydWebhookRoutes from "./src/routes/rapydWebhookRoutes.js";
import notificationsRoutes from "./src/routes/notificationRoutes.js";

import { connectRedis } from "./src/services/redisClient.js";

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(helmet());

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Redis Connection =====
connectRedis().catch(err => console.error("❌ Redis connection failed:", err));

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/health", healthRoutes);

// Webhooks
app.use("/api/webhook/rapyd", rapydWebhookRoutes);

// SSE / Notifications
app.use("/api/notifications", notificationsRoutes);

// ===== Health check route =====
app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
