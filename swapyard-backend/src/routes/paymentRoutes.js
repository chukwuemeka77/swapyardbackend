// src/routes/paymentRoutes.js
import express from "express";
import auth from "../middleware/auth.js";
import { notifyUser } from "../services/sseService.js";
import { publisher } from "../services/redisPubSub.js";

const router = express.Router();

// ==================== Create Payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // Normally, you'd save payment details in your DB
    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // 1️⃣ Notify local SSE clients
    notifyUser(req.user.id, { type: "payment_created", payment });

    // 2️⃣ Publish to Redis for other instances
    try {
      await publisher.publish(
        "notifications",
        JSON.stringify({ userId: req.user.id, data: { type: "payment_created", payment } })
      );
    } catch (err) {
      console.error("❌ Redis publish failed:", err.message);
    }

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment creation failed:", err.message);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// ==================== Payment Success Callback ====================
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    // Normally, update payment status in DB here
    const payment = {
      id: paymentId,
      userId: req.user.id,
      status: "success",
    };

    // 1️⃣ Notify local SSE clients
    notifyUser(req.user.id, { type: "payment_success", payment });

    // 2️⃣ Publish to Redis for other instances
    try {
      await publisher.publish(
        "notifications",
        JSON.stringify({ userId: req.user.id, data: { type: "payment_success", payment } })
      );
    } catch (err) {
      console.error("❌ Redis publish failed:", err.message);
    }

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment success update failed:", err.message);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

export default router;
