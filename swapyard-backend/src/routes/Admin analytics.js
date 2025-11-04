// src/routes/adminAnalytics.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

// GET /api/admin/analytics/totals
router.get("/totals", auth, adminAuth, async (req, res) => {
  try {
    const totals = await Transaction.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    res.json({ success: true, data: totals });
  } catch (err) {
    console.error("analytics.totals error:", err);
    res.status(500).json({ error: "Failed to fetch totals" });
  }
});

// GET /api/admin/analytics/volume (total completed volume & total markup)
router.get("/volume", auth, adminAuth, async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: "$amount" },
          totalMarkup: { $sum: "$markupAmount" },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json({ success: true, data: result[0] || { totalVolume: 0, totalMarkup: 0, count: 0 } });
  } catch (err) {
    console.error("analytics.volume error:", err);
    res.status(500).json({ error: "Failed to fetch volume" });
  }
});

// GET /api/admin/analytics/daily-markup?days=30
router.get("/daily-markup", auth, adminAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days || "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const daily = await Transaction.aggregate([
      { $match: { status: "completed", completedAt: { $gte: since } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          markup: "$markupAmount",
        },
      },
      { $group: { _id: "$day", totalMarkup: { $sum: "$markup" }, txCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: daily });
  } catch (err) {
    console.error("analytics.daily-markup error:", err);
    res.status(500).json({ error: "Failed to fetch daily markup" });
  }
});

// GET /api/admin/analytics/monthly-markup
router.get("/monthly-markup", auth, adminAuth, async (req, res) => {
  try {
    const monthly = await Transaction.aggregate([
      { $match: { status: "completed" } },
      {
        $project: {
          month: { $dateToString: { format: "%Y-%m", date: "$completedAt" } },
          markup: "$markupAmount",
        },
      },
      { $group: { _id: "$month", totalMarkup: { $sum: "$markup" }, txCount: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 24 },
    ]);
    res.json({ success: true, data: monthly });
  } catch (err) {
    console.error("analytics.monthly-markup error:", err);
    res.status(500).json({ error: "Failed to fetch monthly markup" });
  }
});

// GET /api/admin/analytics/by-currency
router.get("/by-currency", auth, adminAuth, async (req, res) => {
  try {
    const byCurrency = await Transaction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$currency",
          totalMarkup: { $sum: "$markupAmount" },
          totalVolume: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalMarkup: -1 } },
    ]);
    res.json({ success: true, data: byCurrency });
  } catch (err) {
    console.error("analytics.by-currency error:", err);
    res.status(500).json({ error: "Failed to fetch by-currency analytics" });
  }
});

// GET /api/admin/analytics/top-users?days=30&limit=50
router.get("/top-users", auth, adminAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days || "30", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const topUsers = await Transaction.aggregate([
      { $match: { status: "completed", completedAt: { $gte: since } } },
      { $group: { _id: "$userId", totalMarkup: { $sum: "$markupAmount" }, txCount: { $sum: 1 } } },
      { $sort: { totalMarkup: -1 } },
      { $limit: limit },
    ]);

    res.json({ success: true, data: topUsers });
  } catch (err) {
    console.error("analytics.top-users error:", err);
    res.status(500).json({ error: "Failed to fetch top users" });
  }
});

module.exports = router;
