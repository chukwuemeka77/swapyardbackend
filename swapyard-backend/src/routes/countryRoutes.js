// src/routes/countryRoutes.js
const express = require("express");
const router = express.Router();
const { rapydRequest } = require("../utils/rapyd");

// GET /api/countries
router.get("/", async (req, res) => {
  try {
    const result = await rapydRequest("GET", "/data/countries");

    res.json({ status: "success", data: result.data || [] });
  } catch (err) {
    console.error("Error fetching countries:", err.response?.data || err.message);
    res.status(500).json({ status: "error", message: "Failed to fetch countries" });
  }
});

module.exports = router;



