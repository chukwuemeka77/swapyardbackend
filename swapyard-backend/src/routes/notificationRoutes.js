// const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { addClient, notifyUser, removeClient } = require("../services/sseService");
const redisClient = require("../services/redisClient");

// ✅ Subscribe to Redis channel for cross-instance notifications
(async () => {
  try {
    // Duplicate client for subscription (so main client can still publish)
    const subscriber = redisClient.duplicate ? redisClient.duplicate() : redisClient;
    if (subscriber.connect) await subscriber.connect();

    await subscriber.subscribe("notifications", (message) => {
      try {
        const { userId, data } = JSON.parse(message);
        notifyUser(userId, data);
      } catch (err) {
        console.error("Redis message parsing error:", err.message || err);
      }
    });

    console.log("📡 Redis Pub/Sub: Subscribed to 'notifications' channel");
  } catch (err) {
    console.error("❌ Redis subscription failed:", err.message || err);
  }
})();

// ==================== SSE stream ====================
router.get("/stream", auth, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.flushHeaders();
  res.write("retry: 10000\n\n"); // reconnect hint

  // Register this client
  addClient(req.user.id, res);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  // Cleanup on disconnect
  req.on("close", () => {
    removeClient(req.user.id, res);
    console.log(`🔌 SSE Client disconnected: ${req.user.id}`);
  });
});

// ==================== Test notification endpoint
