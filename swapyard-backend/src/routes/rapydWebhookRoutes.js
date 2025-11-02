// src/routes/rapydWebhookRoutes.js
const express = require("express");
const router = express.Router();
const redisClient = require("../utils/redisClient");
const { notifyUser } = require("../services/sseService");
const { publishToQueue } = require("../services/rabbitmqService");

router.post("/", async (req, res) => {
  try {
    const event = req.body;
    console.log("📩 Rapyd webhook received:", event.type);

    const userId = event?.data?.metadata?.userId || null;

    // 1️⃣ Always queue the event for background processing
    await publishToQueue("rapydWebhookQueue", event);

    // 2️⃣ Optionally broadcast instantly (for live frontend updates)
    if (userId) {
      const message = {
        type: "rapyd_event_received",
        event: event.type,
        data: event.data,
      };

      // Local instance via SSE
      notifyUser(userId, message);

      // Cross-instance via Redis
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId, data: message })
      );
    }

    // Rapyd expects a fast response
    res.status(200).send("Webhook received ✅");
  } catch (err) {
    console.error("❌ Error handling Rapyd webhook:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
