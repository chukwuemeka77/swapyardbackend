// src/routes/countryRoutes.js
const express = require("express");
const router = express.Router();
const { rapydRequest } = require("../utils/rapyd");

router.get("/", async (req, res) => {
  try {
    const result = await rapydRequest("GET", "/data/countries");

    res.json({ status: "success", data: result.data || [] });
  } catch (err) {
    console.error("Error fetching countries:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
    res.status(500).json({ status: "error", message: "Failed to fetch countries" });
  }
});

module.exports = router;



