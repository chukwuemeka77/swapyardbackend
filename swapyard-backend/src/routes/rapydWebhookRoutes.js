const express = require("express");
const router = express.Router();
const redisClient = require("../services/redisClient");
const { notifyUser } = require("../services/sseService");

// ✅ Rapyd sends POST requests here
router.post("/", async (req, res) => {
  try {
    const event = req.body;

    console.log("📩 Received Rapyd webhook:", event.type);

    // Extract userId from metadata (depends on your payment/wallet creation)
    const userId = event?.data?.metadata?.userId;

    if (userId) {
      // 1️⃣ Notify local SSE clients
      notifyUser(userId, {
        type: "rapyd_event",
        event: event.type,
        data: event.data,
      });

      // 2️⃣ Publish to Redis for other instances
      try {
        await redisClient.publish(
          "notifications",
          JSON.stringify({
            userId,
            data: {
              type: "rapyd_event",
              event: event.type,
              data: event.data,
            },
          })
        );
      } catch (err) {
        console.error("❌ Redis publish failed:", err.message);
      }
    }

    // Always respond 200 to Rapyd quickly
    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Error handling Rapyd webhook:", err.message || err);
    res.status(500).send("Error");
  }
});

module.exports = router;
