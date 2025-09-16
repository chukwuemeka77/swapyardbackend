// src/routes/paymentRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const { notifyUser } = require("../services/sseService");

// Example: handle a payment creation
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // 💡 Normally you'd save payment details in DB here
    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      amount,
      currency,
      status: "pending",
    };

    // Notify the user (frontend listening via /notifications/stream)
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

// Example: simulate payment success callback
router.post("/success/:id", auth, async (req, res) => {
  try {
    const paymentId = req.params.id;

    // 💡 Update DB payment status here...
    const payment = {
      id: paymentId,
      userId: req.user.id,
      status: "success",
    };

    // Notify user that payment is successful
    notifyUser(req.user.id, {
      type: "payment_success",
      payment,
    });

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Payment success update failed:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;

   
