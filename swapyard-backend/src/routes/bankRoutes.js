// src/routes/walletRoutes.js (or a separate bankRoutes.js)
const BankAccount = require("../models/BankAccount");

router.post("/bank/add", auth, async (req, res) => {
  try {
    const { bankName, accountNumber, accountHolderName, currency } = req.body;

    const newAccount = await BankAccount.create({
      userId: req.user.id,
      bankName,
      accountNumber,
      accountHolderName,
      currency,
      isVerified: false, // optional: verify via API with bank
    });

    res.json({ success: true, bankAccount: newAccount });
  } catch (err) {
    console.error("Add bank account failed:", err);
    res.status(500).json({ error: "Failed to add bank account" });
  }
});
