// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json()); // default JSON parser for most routes
app.use(helmet()); // Mount helmet

// Optional custom CSP
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  })
);

// ===== Routes =====
const authRoutes = require("./src/routes/auth.js");
app.use("/api/auth", authRoutes);

const countriesRoutes = require("./src/routes/countries.js");
app.use("/api/countries", countriesRoutes);

// ✅ Health-check route
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbStatus = states[dbState] || "unknown";

  const health = {
    status: dbStatus === "connected" ? "ok" : "error",
    message: "Server health check",
    db: dbStatus,
    uptime: `${Math.floor(process.uptime())}s`,
    env: process.env.NODE_ENV || "development",
  };

  // If you want Render to fail health check when DB is down:
  if (dbStatus !== "connected") {
    return res.status(500).json(health);
  }

  res.json(health);
});

// ✅ Use express.raw ONLY for Rapyd webhooks
const rapydWebhookRoutes = require("./src/routes/rapydWebhook");
app.use(
  "/api/rapyd/webhook",
  express.raw({ type: "application/json" }), // keep raw body for HMAC verification
  rapydWebhookRoutes
);

// ===== Database =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));
// server.js (after DB connection)
const { processFailedWebhooks } = require("./src/services/webhookRetryProcessor");

// Run every 2 minutes
setInterval(() => {
  processFailedWebhooks(5).catch(err =>
    console.error("Retry processor error:", err)
  );
}, 2 * 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


