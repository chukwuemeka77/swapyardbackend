const express = require("express");
const fetch = require("node-fetch"); // or axios
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const response = await fetch("https://sandboxapi.rapyd.net/v1/countries", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.RAPYD_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    res.json(data); // send the country list to frontend
  } catch (err) {
    console.error("Error fetching countries:", err);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

module.exports = router;
