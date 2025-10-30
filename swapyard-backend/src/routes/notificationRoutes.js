// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { addClient, notifyUser } = require("../services/sseService");
const { createClient } = require("redis");
const redisClient = require("../utils/redisClient");

// Subscribe to Redis channel for cross-instance notifications
(async () => {
  try {
    const subscriber = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    subscriber.on("error", (err) => console.error("Redis Subscriber Error:", err));
    await subscriber.connect();

    await subscriber.subscribe("notifications", (message) => {
      const { userId, data } = JSON.parse(message);
      notifyUser(userId, data);
    });

    console.log("📡 Redis Pub/Sub: Subscribed to 'notifications' channel");
  } catch (err) {
    console.error("❌ Redis subscription failed:", err.message);
  }
})();

// SSE stream for real-time notifications
router.get("/stream", auth, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.flushHeaders();
  res.write("retry: 10000\n\n");

  addClient(req.user.id, res);
  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  req.on("close", () => {
    console.log(`🔌 Client disconnected: ${req.user.id}`);
  });
});

// Endpoint to send a test notification manually
router.post("/test", auth, async (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };

  notifyUser(req.user.id, message);

  try {
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: message })
    );
  } catch (err) {
    console.error("❌ Redis publish failed:", err.message);
  }

  res.json({ success: true, message });
});

module.exports = router;
