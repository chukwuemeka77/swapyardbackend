const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { sendToQueue } = require("../services/rabbitmqService");

// ==================== Create payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency, walletId } = req.body;

    const transactionId = Date.now().toString(); // simple unique ID

    // enqueue job for background worker
    await sendToQueue("paymentQueue", { userId: req.user.id, walletId, amount, currency, transactionId });

    // immediate notification (optional)
    notifyUser(req.user.id, {
      type: "payment_created",
      data: { amount, currency, transactionId },
    });

    // cross-instance notification
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "payment_created", amount, currency, transactionId } })
    );

    res.json({ success: true, message: "Payment queued", transactionId });
  } catch (err) {
    console.error("Payment creation failed:", err);
    res.status(500).json({ error: "Failed to queue payment" });
  }
});

// ==================== Simulate payment success callback ====================
router.post("/success/:id", auth, async (req, res) => {
  try {
    const transactionId = req.params.id;

    // For now, just notify front-end (worker already charged wallet)
    notifyUser(req.user.id, {
      type: "payment_success",
      data: { transactionId },
    });

    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "payment_success", transactionId } })
    );

    res.json({ success: true, transactionId });
  } catch (err) {
    console.error("Payment success update failed:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;
