const express = require("express");
const auth = require("../middleware/auth");
const { addClient } = require("../services/sseService");

const router = express.Router();

router.get("/stream", auth, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  res.flushHeaders();
  res.write("retry: 10000\n\n");

  addClient(req.user.id, res);

  res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);

  req.on("close", () => {
    // client cleanup handled automatically by garbage collection
  });
});

module.exports = router;
