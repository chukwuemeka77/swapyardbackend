// src/routes/countryRoutes.js
const express = require("express");
const router = express.Router();
const { rapydRequest } = require("../utils/rapyd");
const redisClient = require("../utils/redisClient"); // Import your Redis client

router.get("/", async (req, res) => {
  try {
    // 1️⃣ Check Redis cache first
    const cachedCountries = await redisClient.get("rapyd:countries");

    if (cachedCountries) {
      console.log("✅ Serving countries from Redis cache");
      return res.json({
        status: "success",
        source: "cache",
        data: JSON.parse(cachedCountries),
      });
    }

    // 2️⃣ If not cached, fetch from Rapyd API
    const result = await rapydRequest("GET", "/data/countries");
    const countries = result.data || [];

    // 3️⃣ Store in Redis with TTL (e.g., 24 hours = 86400 seconds)
    await redisClient.set("rapyd:countries", JSON.stringify(countries), { ex: 86400 });

    console.log("🌍 Fetched and cached countries from Rapyd API");
    res.json({
      status: "success",
      source: "api",
      data: countries,
    });
  } catch (err) {
    console.error("❌ Error fetching countries:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    res.status(500).json({ status: "error", message: "Failed to fetch countries" });
  }
});

module.exports = router;
