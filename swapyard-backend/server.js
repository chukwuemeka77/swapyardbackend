// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

// Import routes
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const countryRoutes = require("./src/routes/countryRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const rapydWebhookRoutes = require("./src/routes/rapydWebhookRoutes");

// DB config
const connectDB = require("./src/config/db");

// Initialize app
const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// Helmet security (with basic CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// ===== Routes =====
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", rapydWebhookRoutes);

// ===== Server & DB =====
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
});
