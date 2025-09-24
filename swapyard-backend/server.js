const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
console.log("Access Key:", process.env.RAPYD_ACCESS_KEY);
console.log("Secret Key:", process.env.RAPYD_SECRET_KEY);

const helmet = require("helmet");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json()); // Parse JSON
app.use(helmet());

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Routes =====
const userRoutes = require("./src/routes/userRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const countryRoutes = require("./src/routes/countryRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");
const notificationsRoutes = require("./src/routes/notificationRoutes");

// Regular routes
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/health", healthRoutes);

// Webhooks (Rapyd calls this directly)
app.use("/api/webhook/rapyd", rapydWebhookRoutes);

// SSE notifications stream
app.use("/api/notifications", notificationsRoutes);

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
