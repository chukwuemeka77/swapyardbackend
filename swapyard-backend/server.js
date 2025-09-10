// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");
const bodyParser = require("body-parser");

const app = express();

// ===== Middleware =====
app.use(cors());

// Security headers
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

// Normal JSON parsing for all routes EXCEPT Rapyd webhook
app.use(express.json());

// ===== Routes =====
const authRoutes = require("./src/routes/auth.js");
app.use("/api/auth", authRoutes);

const countriesRoutes = require("./src/routes/countries.js");
app.use("/api/countries", countriesRoutes);

// ⚡ Special raw body parser for Rapyd webhook
const rapydWebhookRoutes = require("./src/routes/rapydWebhook");
app.use(
  "/api/rapyd/webhook",
  bodyParser.raw({ type: "application/json" }), // keep raw buffer
  (req, res, next) => {
    try {
      // Save raw body for signature verification
      req.rawBody = req.body.toString("utf8");
      req.body = JSON.parse(req.rawBody); // re-parse to JSON for handler
    } catch (err) {
      console.error("Webhook body parse error:", err);
    }
    next();
  },
  rapydWebhookRoutes
);

// ===== Database =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
