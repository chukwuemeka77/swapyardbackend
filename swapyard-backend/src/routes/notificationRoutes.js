// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const redisClient = require("../utils/redisClient");

// In-memory SSE clients per instance
const sseClients = {};

// Register a client for SSE
function addClient(userId, res) {
  if (!sseClients[userId]) sseClients[userId] = new Set();
  sseClients[userId].add(res);
}

// Send event to local clients
function notifyUser(userId, data) {
  if (!sseClients[userId]) return;
  for (const client of sseClients[userId]) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// Subscribe to Redis notifications channel (multi-instance safe)
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

// SSE stream endpoint
router.get("/stream", auth, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.flushHeaders();
  res.write("retry: 10000\n\n"); // reconnect hint

  addClient(req.user.id, res);

  // Send handshake
  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  req.on("close", () => {
    console.log(`🔌 Client disconnected: ${req.user.id}`);
    sseClients[req.user.id]?.delete(res);
  });
});

// Endpoint to send a test notification
router.post("/test", auth, async (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };

  // 1️⃣ Notify local clients
  notifyUser(req.user.id, message);

  // 2️⃣ Publish to Redis for other instances
  try {
    await redisClient.publish("notifications", JSON.stringify({ userId: req.user.id, data: message }));
  } catch (err) {
    console.error("❌ Redis publish failed:", err.message);
  }

  res.json({ success: true, message });
});

module.exports = router;
