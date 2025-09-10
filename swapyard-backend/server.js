// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// Capture rawBody specifically for Rapyd webhooks
app.use("/api/rapyd/webhook", express.raw({ type: "application/json" }));

// CSP example
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

const rapydWebhookRoutes = require("./src/routes/rapydWebhook");
app.use("/api/rapyd/webhook", rapydWebhookRoutes);

// ===== Database =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
