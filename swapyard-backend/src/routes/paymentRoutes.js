// src/routes/paymentRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../utils/redisClient");
const axios = require("axios");

// Create a new payment
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // Generate a unique payment ID
    const paymentId = Date.now().toString();

    const payment = {
      id: paymentId,
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // Save to Redis temporarily (expiry 10 mins)
    await redisClient.setEx(`payment:${paymentId}`, 600, JSON.stringify(payment));

    // Notify user via SSE
    notifyUser(req.user.id, {
      type: "payment_created",
      payment,
    });

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment creation failed:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// Simulate a successful payment callback or Rapyd webhook
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    // Retrieve payment from Redis
    const cachedPayment = await redisClient.get(`payment:${paymentId}`);
    if (!cachedPayment) return res.status(404).json({ error: "Payment not found" });

    const payment = JSON.parse(cachedPayment);
    payment.status = "success";

    // Update Redis cache with new status
    await redisClient.setEx(`payment:${paymentId}`, 600, JSON.stringify(payment));

    // Notify user locally
    notifyUser(req.user.id, {
      type: "payment_success",
      payment,
    });

    // Optional: publish to Redis channel for other instances
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

// Example: Transfer from user wallet via Rapyd
router.post("/transfer", auth, async (req, res) => {
  try {
    const { amount, currency, destinationWalletId } = req.body;

    // Fetch user's default wallet from Redis or DB if needed
    // Here we assume req.user.walletId is set
    const response = await axios.post(
      "https://sandboxapi.rapyd.net/v1/transfers",
      {
        source_ewallet: req.user.walletId,
        amount,
        currency,
        destination_ewallet: destinationWalletId,
      },
      {
        headers: {
          access_key: process.env.RAPYD_API_KEY,
          secret_key: process.env.RAPYD_SECRET_KEY,
        },
      }
    );

    const transfer = response.data.data;

    // Notify user
    notifyUser(req.user.id, { type: "transfer_created", transfer });

    res.json({ success: true, transfer });
  } catch (err) {
    console.error("Transfer failed:", err.response?.data || err);
    res.status(500).json({ error: "Failed to create transfer" });
  }
});

module.exports = router;
