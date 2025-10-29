// src/routes/notificationRoutes.js
import express from "express";
import auth from "../middleware/auth.js";
import { addClient, notifyUser } from "../services/sseService.js";
import { subscriber, publisher } from "../services/redisPubSub.js";

const router = express.Router();

// ==================== Redis Pub/Sub Setup ====================

// Subscribe to 'notifications' channel for cross-instance updates
(async () => {
  try {
    await subscriber.subscribe("notifications", (message) => {
      const { userId, data } = JSON.parse(message);
      notifyUser(userId, data); // forward to local SSE clients
    });
    console.log("📡 Redis Pub/Sub: Subscribed to 'notifications'");
  } catch (err) {
    console.error("❌ Redis subscription failed:", err.message);
  }
})();

// ==================== SSE Stream ====================
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
    console.log(`🔌 SSE client disconnected: ${req.user.id}`);
  });
});

// ==================== Test Notification ====================
router.post("/test", auth, async (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };

  // 1️⃣ Notify local SSE clients
  notifyUser(req.user.id, message);

  // 2️⃣ Publish to Redis for other instances
  try {
    await publisher.publish("notifications", JSON.stringify({ userId: req.user.id, data: message }));
  } catch (err) {
    console.error("❌ Redis publish failed:", err.message);
  }

  res.json({ success: true, message });
});

export default router;
