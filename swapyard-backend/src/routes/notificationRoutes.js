// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { addClient, notifyUser } = require("../services/sseService");
const redisClient = require("../utils/redisClient");

// Subscribe to Redis channel for cross-instance notifications
(async () => {
  try {
    const subscriber = redisClient.duplicate();
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
  res.write("retry: 10000\n\n"); // hint browser to retry on disconnect

  // Register SSE client
  addClient(req.user.id, res);

  // Send handshake message
  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  req.on("close", () => {
    console.log(`🔌 Client disconnected: ${req.user.id}`);
  });
});

// Endpoint to send a test notification manually
router.post("/test", auth, async (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };

  // Notify local instance
  notifyUser(req.user.id, message);

  // Publish to Redis (for other instances)
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
