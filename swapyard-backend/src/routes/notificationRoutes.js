// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { connectRedis, publishNotification, setNotifyUser } = require("../services/redisClient");
const { addClient, notifyUser: notifyLocalUser } = require("../services/sseService");

// Link local SSE to Redis notifications
setNotifyUser(notifyLocalUser);

// Connect Redis on route load
connectRedis().catch(err => console.error("❌ Redis subscription failed:", err));

// SSE endpoint
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

// Test notification
router.post("/test", auth, async (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };

  notifyLocalUser(req.user.id, message);

  try {
    await publishNotification(req.user.id, message);
  } catch (err) {
    console.error("❌ Redis publish failed:", err);
  }

  res.json({ success: true, message });
});

module.exports = router;
