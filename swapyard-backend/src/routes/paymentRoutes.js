const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { rapydRequest } = require("../services/rapydService");
const MarkupSetting = require("../models/markupSettings");

// ==================== Create payment ====================
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // ✅ Fetch markup
    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupAmount = markup ? (amount * markup.percentage) / 100 : 0;
    const finalAmount = amount + markupAmount;

    // 💡 Create payment on Rapyd
    const paymentData = {
      amount: finalAmount,
      currency,
      metadata: { userId: req.user.id },
    };

    const rapydResponse = await rapydRequest("POST", "/v1/payments", paymentData);

    const payment = {
      id: rapydResponse.data.id,
      userId: req.user.id,
      amount: finalAmount,
      originalAmount: amount,
      currency,
      status: "pending",
    };

    // ✅ Notify local SSE
    notifyUser(req.user.id, { type: "payment_created", payment });

    // ✅ Publish to Redis for multi-instance
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

// ==================== Simulate payment success callback ====================
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    // ✅ Optionally call Rapyd to verify payment status
    const rapydStatus = await rapydRequest("GET", `/v1/payments/${paymentId}`);

    const payment = {
      id: paymentId,
      userId: req.user.id,
      status: rapydStatus.data.status || "success",
    };

    // ✅ Notify SSE
    notifyUser(req.user.id, { type: "payment_success", payment });

    // ✅ Redis Pub/Sub
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
