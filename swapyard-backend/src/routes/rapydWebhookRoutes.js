// src/routes/rapydWebhookRoutes.js
const express = require("express");
const redisClient = require("../utils/redisClient");
const { notifyUser } = require("../routes/notificationRoutes");
const { sendToQueue } = require("../services/rabbitmqService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const event = req.body;
    console.log("Received Rapyd webhook:", event.type);

    const userId = event?.data?.metadata?.userId;

    if (userId) {
      // 1️⃣ Notify user instantly
      notifyUser(userId, {
        type: "rapyd_event",
        event: event.type,
        data: event.data,
      });

      // 2️⃣ Redis broadcast for multi-instance
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

      // 3️⃣ Push to RabbitMQ for background handling
      await sendToQueue("rapydWebhookQueue", event);
    }

    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Error handling Rapyd webhook:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
