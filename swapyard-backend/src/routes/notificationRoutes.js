// src/routes/notificationRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const { addClient, notifyUser, sseClients } = require("../services/sseService");

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

  // Send initial hello event
  res.write(
    `data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`
  );

  req.on("close", () => {
    if (sseClients[req.user.id]) {
      sseClients[req.user.id].delete(res);
      if (sseClients[req.user.id].size === 0) {
        delete sseClients[req.user.id];
      }
    }
  });
});

module.exports = router;
