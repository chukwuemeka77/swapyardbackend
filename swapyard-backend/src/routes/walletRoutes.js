const router = require("express").Router();
const auth = require("../middleware/auth");
const { sendToQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

// Deposit
router.post("/deposit", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const job = { userId: req.user.id, amount, currency, transactionId: Date.now().toString() };
    await sendToQueue("depositQueue", job);

    notifyUser(req.user.id, { type: "deposit_in_progress", data: { amount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "deposit_in_progress", amount, currency } })
    );

    res.json({ success: true, message: "Deposit queued for processing" });
  } catch (err) {
    console.error("Deposit failed:", err);
    res.status(500).json({ error: "Failed to queue deposit" });
  }
});

// Exchange
router.post("/exchange", auth, async (req, res) => {
  try {
    const { fromCurrency, toCurrency, amount, baseRate } = req.body;
    const pair = `${fromCurrency}/${toCurrency}`;
    const job = { userId: req.user.id, pair, amount, baseRate, transactionId: Date.now().toString() };

    await sendToQueue("exchangeQueue", job);

    notifyUser(req.user.id, { type: "exchange_in_progress", data: { pair, amount } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "exchange_in_progress", pair, amount } })
    );

    res.json({ success: true, message: "Exchange queued for processing" });
  } catch (err) {
    console.error("Exchange failed:", err);
    res.status(500).json({ error: "Failed to queue exchange" });
  }
});

// Withdrawal
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { amount, currency, bankAccountId } = req.body;
    const job = { userId: req.user.id, amount, currency, bankAccountId, transactionId: Date.now().toString() };

    await sendToQueue("withdrawQueue", job);

    notifyUser(req.user.id, { type: "withdraw_in_progress", data: { amount, currency } });
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "withdraw_in_progress", amount, currency } })
    );

    res.json({ success: true, message: "Withdrawal queued for processing" });
  } catch (err) {
    console.error("Withdrawal failed:", err);
    res.status(500).json({ error: "Failed to queue withdrawal" });
  }
});

module.exports = router;
