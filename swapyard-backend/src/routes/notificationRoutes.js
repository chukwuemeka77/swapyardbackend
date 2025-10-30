// notificationRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { connectRedis, publishNotification, setNotifyUser } = require("../services/redisPubSub");
const { addClient, notifyUser: notifyLocalUser } = require("../services/sseService");

// Link local SSE notifier to Redis subscriber
setNotifyUser(notifyLocalUser);

// Connect Redis when routes are loaded
connectRedis().catch(err => console.error("❌ Redis subscription failed:", err));

// SSE stream for real-time notifications
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

  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  req.on("close", () => {
    console.log(`🔌 Client disconnected: ${req.user.id}`);
  });
});

// Test notification endpoint
router.post("/test", auth, async (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };

  // 1️⃣ Notify local clients
  notifyLocalUser(req.user.id, message);

  // 2️⃣ Publish to Redis for multi-instance
  try {
    await publishNotification(req.user.id, message);
  } catch (err) {
    console.error("❌ Redis publish failed:", err);
  }

  res.json({ success: true, message });
});

module.exports = router;
