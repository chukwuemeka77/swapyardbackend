// src/routes/recurringRoutes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const RecurringPayment = require("../models/RecurringPayment");
const MarkupSetting = require("../models/markupSettings");
const { enqueueJob } = require("../services/rabbitmqService");

// Create recurring payment
router.post("/create", auth, async (req, res) => {
  try {
    const { amount, currency, schedule } = req.body;

    // Fetch markup from markupSettings
    const markup = await MarkupSetting.findOne({ type: "payment" });
    const markupPercent = markup ? markup.percentage : 0;

    const recurring = await RecurringPayment.create({
      userId: req.user.id,
      amount,
      currency,
      schedule,
      nextRun: new Date(), // start immediately or compute next run from schedule
      markupPercent,
    });

    // Enqueue job
    await enqueueJob("recurringPaymentQueue", { paymentId: recurring._id });

    res.json({ success: true, recurring });
  } catch (err) {
    console.error("❌ Failed to create recurring payment:", err.message);
    res.status(500).json({ error: "Failed to create recurring payment" });
  }
});

module.exports = router;
