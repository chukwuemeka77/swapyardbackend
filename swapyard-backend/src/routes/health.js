// src/routes/health.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Helper to format uptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ===== Health Check Route =====
router.get("/", (req, res) => {
  const uptime = formatUptime(process.uptime());
  const env = process.env.NODE_ENV || "development";

  res.json({
    status: "ok",
    message: "Server is running",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime,
    env,
  });
});

module.exports = router;
