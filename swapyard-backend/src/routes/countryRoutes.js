// src/routes/countryRoutes.js
const express = require("express");
const { rapydRequest } = require("../utils/rapyd");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rapydData = await rapydRequest("get", "/data/countries");

    // Rapyd wraps results in data
    res.json({ countries: rapydData.data || [] });
  } catch (err) {
    console.error("Error fetching countries:", err.response?.data || err.message);
    res.status(500).json({ error: "Server error fetching countries" });
  }
});

module.exports = router;


