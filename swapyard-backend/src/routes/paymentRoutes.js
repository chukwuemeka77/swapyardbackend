const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

// ==================== Create payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // 💡 Normally, save payment details in DB here
    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // 1️⃣ Notify local SSE clients
    notifyUser(req.user.id, {
      type: "payment_created",
      payment,
    });

    // 2️⃣ Publish to Redis for other instances
    try {
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId: req.user.id, data: { type: "payment_created", payment } })
      );
    } catch (err) {
      console.error("❌ Redis publish failed:", err.message || err);
    }

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment creation failed:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// ==================== Simulate payment success callback ====================
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    // 💡 Normally, update payment status in DB here
    const payment = {
      id: paymentId,
      userId: req.user.id,
      status: "success",
    };

    // 1️⃣ Notify local SSE clients
    notifyUser(req.user.id, {
      type: "payment_success",
      payment,
    });

    // 2️⃣ Publish to Redis for other instances
    try {
      await redisClient.publish(
        "notifications",
        JSON.stringify({ userId: req.user.id, data: { type: "payment_success", payment } })
      );
    } catch (err) {
      console.error("❌ Redis publish failed:", err.message || err);
    }

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment success update failed:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;
