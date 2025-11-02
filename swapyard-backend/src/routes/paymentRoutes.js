const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { publishToQueue } = require("../services/rabbitmqService");

// ==================== Create Payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // 💡 Normally, you would save this in MongoDB (Transaction model)
    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // 1️⃣ Queue the payment for background processing (RabbitMQ)
    await publishToQueue("paymentQueue", {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
    });

    // 2️⃣ Notify local SSE clients
    notifyUser(req.user.id, {
      type: "payment_created",
      payment,
    });

    // 3️⃣ Publish to Redis for other instances
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId: req.user.id,
        data: { type: "payment_created", payment },
      })
    );

    res.json({ success: true, message: "Payment queued for processing", payment });
  } catch (err) {
    console.error("❌ Payment creation failed:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// ==================== Payment Success Callback ====================
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    // 💡 Normally, update payment status in MongoDB
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
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId: req.user.id,
        data: { type: "payment_success", payment },
      })
    );

    res.json({ success: true, message: "Payment marked as successful", payment });
  } catch (err) {
    console.error("❌ Payment success update failed:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;
