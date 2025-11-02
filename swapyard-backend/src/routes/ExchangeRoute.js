// src/routes/exchangeRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const { publishToQueue } = require("../services/rabbitmqService");

// Create exchange request
router.post("/convert", auth, async (req, res) => {
  try {
    const { fromCurrency, toCurrency, amount } = req.body;

    const exchange = {
      id: Date.now().toString(),
      userId: req.user.id,
      fromCurrency,
      toCurrency,
      amount,
      status: "pending",
    };

    // If you have a Transaction model, create a pending transaction here (optional)
    // const tx = await Transaction.create({ ... })

    // Queue the exchange job for background processing
    await publishToQueue("exchangeQueue", {
      userId: req.user.id,
      fromCurrency,
      toCurrency,
      amount,
      transactionId: exchange.id,
    });

    // Instant feedback to user
    notifyUser(req.user.id, { type: "exchange_started", exchange });

    // Broadcast across instances
    await redisClient.publish(
      "notifications",
      JSON.stringify({ userId: req.user.id, data: { type: "exchange_started", exchange } })
    );

    res.status(202).json({ success: true, exchange });
  } catch (err) {
    console.error("❌ Exchange request failed:", err);
    res.status(500).json({ error: "Failed to start exchange" });
  }
});

module.exports = router;
