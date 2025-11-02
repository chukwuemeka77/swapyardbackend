const router = require("express").Router();
const auth = require("../middleware/auth");
const { publishToQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

// ==================== Create payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const transactionId = Date.now().toString();

    // Enqueue payment job
    await publishToQueue("paymentQueue", { id: transactionId, userId: req.user.id, amount, currency });

    notifyUser(req.user.id, { type: "payment_pending", data: { amount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "payment_pending", amount, currency } })
    );

    res.json({ success: true, message: "Payment queued", transactionId });
  } catch (err) {
    console.error("Payment failed:", err);
    res.status(500).json({ error: "Failed to enqueue payment" });
  }
});

module.exports = router;
