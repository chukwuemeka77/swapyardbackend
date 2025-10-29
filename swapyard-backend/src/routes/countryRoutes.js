// src/routes/countryRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const redisClient = require("../utils/redisClient");

// GET /api/countries
router.get("/", async (req, res) => {
  try {
    const cacheKey = "rapyd_countries";
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json({ status: "success", data: JSON.parse(cached) });
    }

    // Fetch from Rapyd API
    const response = await axios.get("https://sandboxapi.rapyd.net/v1/data/countries", {
      headers: {
        access_key: process.env.RAPYD_API_KEY,
        secret_key: process.env.RAPYD_SECRET_KEY,
      },
    });

    const countries = response.data.data;

    // Cache for 24h
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(countries));

    res.json({ status: "success", data: countries });
  } catch (err) {
    console.error("Error fetching countries:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    res.status(500).json({ status: "error", message: "Failed to fetch countries" });
  }
});

module.exports = router;
