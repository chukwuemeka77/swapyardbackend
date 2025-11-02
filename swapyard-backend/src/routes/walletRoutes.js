const router = require("express").Router();
const auth = require("../middleware/auth");
const { publishToQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

// ==================== Deposit ====================
router.post("/deposit", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const transactionId = Date.now().toString();

    // Enqueue deposit job
    await publishToQueue("depositQueue", { userId: req.user.id, amount, currency, transactionId });

    // Notify user immediately (pending)
    notifyUser(req.user.id, { type: "deposit_pending", data: { amount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "deposit_pending", amount, currency } })
    );

    res.json({ success: true, message: "Deposit queued", transactionId });
  } catch (err) {
    console.error("Deposit failed:", err);
    res.status(500).json({ error: "Failed to enqueue deposit" });
  }
});

// ==================== Exchange ====================
router.post("/exchange", auth, async (req, res) => {
  try {
    const { fromCurrency, toCurrency, amount, baseRate } = req.body;
    const transactionId = Date.now().toString();
    const pair = `${fromCurrency}/${toCurrency}`;

    await publishToQueue("exchangeQueue", { userId: req.user.id, pair, amount, baseRate, transactionId });

    notifyUser(req.user.id, { type: "exchange_pending", data: { pair, amount } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "exchange_pending", pair, amount } })
    );

    res.json({ success: true, message: "Exchange queued", transactionId });
  } catch (err) {
    console.error("Exchange failed:", err);
    res.status(500).json({ error: "Failed to enqueue exchange" });
  }
});

// ==================== Withdraw ====================
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, currency, bankAccountId } = req.body;
    const transactionId = Date.now().toString();

    await publishToQueue("withdrawQueue", { userId: req.user.id, amount, currency, bankAccountId, transactionId });

    notifyUser(req.user.id, { type: "withdraw_pending", data: { amount, currency, bankAccountId } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "withdraw_pending", amount, currency, bankAccountId } })
    );

    res.json({ success: true, message: "Withdrawal queued", transactionId });
  } catch (err) {
    console.error("Withdraw failed:", err);
    res.status(500).json({ error: "Failed to enqueue withdrawal" });
  }
});

module.exports = router;
