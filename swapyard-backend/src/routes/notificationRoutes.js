const router = require("express").Router();
const auth = require("../middleware/auth");
const { addClient, notifyUser } = require("../services/sseService");

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

  // Register this client
  addClient(req.user.id, res);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  // Cleanup on disconnect
  req.on("close", () => {
    console.log(`🔌 Client disconnected: ${req.user.id}`);
  });
});

// Optional: endpoint to trigger test notification
router.post("/test", auth, (req, res) => {
  const message = { type: "test", msg: "This is a test notification" };
  notifyUser(req.user.id, message);
  res.json({ success: true, message });
});

module.exports = router;

