const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { publishToQueue } = require("../services/rabbitmqService");
const MarkupSetting = require("../models/markupSettings");

// ==================== Create payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // 💡 Normally, save payment in DB
    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // apply markup if configured
    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupAmount = markup ? (amount * markup.percentage) / 100 : 0;
    const finalAmount = amount - markupAmount;
    payment.finalAmount = finalAmount;
    payment.markupPercent = markup ? markup.percentage : 0;

    // 1️⃣ Notify local SSE clients
    notifyUser(req.user.id, { type: "payment_created", payment });

    // 2️⃣ Redis Pub/Sub cross-instance
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "payment_created", payment } })
    );

    // 3️⃣ Optional: enqueue RabbitMQ worker if needed
    await publishToQueue("paymentQueue", { userId: req.user.id, payment });

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment creation failed:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// ==================== Payment success ====================
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    const payment = {
      id: paymentId,
      userId: req.user.id,
      status: "success",
    };

    // SSE
    notifyUser(req.user.id, { type: "payment_success", payment });

    // Redis Pub/Sub
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "payment_success", payment } })
    );

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment success update failed:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;
