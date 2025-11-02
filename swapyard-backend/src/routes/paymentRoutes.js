const router = require("express").Router();
const auth = require("../middleware/auth");
const { sendToQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

// Create Payment
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const payment = { id: Date.now().toString(), userId: req.user.id, amount, currency, status: "pending" };

    await sendToQueue("paymentQueue", { ...payment });

    notifyUser(req.user.id, { type: "payment_created", payment });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "payment_created", payment } })
    );

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment creation failed:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

module.exports = router;
