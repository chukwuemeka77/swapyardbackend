const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Helper: format uptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ===== Health Check Route =====
router.get("/", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1; // 1 = connected
  const uptime = formatUptime(process.uptime());
  const env = process.env.NODE_ENV || "development";

  if (!dbConnected) {
    return res.status(500).json({
      status: "error",
      message: "Database not connected",
      db: "disconnected",
      uptime,
      env,
    });
  }

  res.status(200).json({
    status: "ok",
    message: "Server is healthy",
    db: "connected",
    uptime,
    env,
  });
});

module.exports = router;

