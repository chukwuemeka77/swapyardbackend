// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../routes/notificationRoutes"); // reuse local SSE notifier
const redisClient = require("../utils/redisClient");

// Create payment
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // Simulate payment object (replace with real DB save)
    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // 1️⃣ Notify local connected clients
    notifyUser(req.user.id, { type: "payment_created", payment });

    // 2️⃣ Publish to Redis so other instances get notified
    await redisClient.publish("notifications", JSON.stringify({ userId: req.user.id, data: { type: "payment_created", payment } }));

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment creation failed:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// Simulate payment success callback
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    const payment = {
      id: paymentId,
      userId: req.user.id,
      status: "success",
    };

    // Notify local clients
    notifyUser(req.user.id, { type: "payment_success", payment });

    // Publish to Redis for other instances
    await redisClient.publish("notifications", JSON.stringify({ userId: req.user.id, data: { type: "payment_success", payment } }));

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment success update failed:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;
