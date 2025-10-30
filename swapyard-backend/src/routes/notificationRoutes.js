// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();

const { addClient, notifyUser } = require("../services/sseService");
const redisClient = require("../utils/redisClient");

// SSE endpoint: /api/notifications/stream/:userId
router.get("/stream/:userId", (req, res) => {
  const { userId } = req.params;

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Register this connection
  addClient(userId, res);

  // Initial welcome message
  res.write(`data: ${JSON.stringify({ message: "Connected to SSE" })}\n\n`);
});

// Allow local and Redis-triggered notifications
router.post("/notify", async (req, res) => {
  const { userId, data } = req.body;

  if (!userId || !data) {
    return res.status(400).json({ error: "userId and data required" });
  }

  // Notify local clients
  notifyUser(userId, data);

  // Notify via Redis (for other instances)
  await redisClient.publish(
    "notifications",
    JSON.stringify({ userId, data })
  );

  res.json({ success: true });
});

module.exports = { router, notifyUser };
