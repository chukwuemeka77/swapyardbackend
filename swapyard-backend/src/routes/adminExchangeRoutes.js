// src/routes/adminExchangeRoutes.js
const express = require("express");
const router = express.Router();
const ExchangeRate = require("../models/ExchangeRate");

// Add or update an exchange rate + optional markupPercent
router.put("/rate/:pair", async (req, res) => {
  try {
    const pair = req.params.pair.toUpperCase();
    const { rate, markupPercent, active, note } = req.body;

    if (typeof rate !== "number") return res.status(400).json({ error: "rate (number) is required" });

    const update = { rate, note };
    if (typeof markupPercent === "number") update.markupPercent = markupPercent;
    if (typeof active === "boolean") update.active = active;

    const doc = await ExchangeRate.findOneAndUpdate({ pair }, update, { upsert: true, new: true });
    res.json({ success: true, rate: doc });
  } catch (err) {
    console.error("Admin set rate failed:", err.message || err);
    res.status(500).json({ error: "Failed to set exchange rate" });
  }
});

// GET rates (list)
router.get("/rates", async (req, res) => {
  try {
    const rates = await ExchangeRate.find().sort({ pair: 1 });
    res.json({ success: true, rates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
