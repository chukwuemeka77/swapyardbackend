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

helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "https://cdn.jsdelivr.net"],
    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
  },
});

// ===== Routes =====
const authRoutes = require("./src/routes/auth.js");
app.use("/api/auth", authRoutes);

const countriesRoutes = require("./src/routes/countries.js");
app.use("/api/countries", countriesRoutes);

// ✅ Health-check route
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus;

  switch (dbState) {
    case 0:
      dbStatus = "disconnected";
      break;
    case 1:
      dbStatus = "connected";
      break;
    case 2:
      dbStatus = "connecting";
      break;
    case 3:
      dbStatus = "disconnecting";
      break;
    default:
      dbStatus = "unknown";
  }

  res.json({
    status: "ok",
    message: "Server is running",
    db: dbStatus,
  });
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

