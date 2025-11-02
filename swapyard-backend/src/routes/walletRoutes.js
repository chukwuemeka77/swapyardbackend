const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { sendToQueue } = require("../services/rabbitmqService");

// ==================== Create deposit ====================
router.post("/deposit", auth, async (req, res) => {
  try {
    const { amount, currency, walletId } = req.body;
    const transactionId = Date.now().toString();

    // enqueue deposit job
    await sendToQueue("depositQueue", { userId: req.user.id, walletId, amount, currency, transactionId });

    // notify front-end immediately
    notifyUser(req.user.id, {
      type: "deposit_created",
      data: { amount, currency, transactionId },
    });

    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "deposit_created", amount, currency, transactionId } })
    );

    res.json({ success: true, transactionId, message: "Deposit queued" });
  } catch (err) {
    console.error("Deposit creation failed:", err);
    res.status(500).json({ error: "Failed to queue deposit" });
  }
});

module.exports = router;
