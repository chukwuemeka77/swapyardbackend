const router = require("express").Router();
const auth = require("../middleware/auth");
const Withdrawal = require("../models/Withdrawal");
const { publishToQueue } = require("../services/rabbitmqService");

// withdraw endpoint
router.post("/withdraw", auth, async (req, res) => {
  const { amount, currency, bankAccountId } = req.body;

  const withdrawal = await Withdrawal.create({
    userId: req.user.id,
    amount,
    currency,
    bankAccountId,
    finalAmount: amount, // worker will update after markup
  });

  // enqueue job
  await publishToQueue("withdrawalQueue", { userId: req.user.id, withdrawalId: withdrawal._id });

  res.json({ success: true, withdrawal });
});

module.exports = router;
