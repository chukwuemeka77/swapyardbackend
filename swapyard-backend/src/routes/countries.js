const express = require("express");
const router = express.Router();

// Example: fetch Rapyd-supported countries from Rapyd API
router.get("/", async (req, res) => {
  try {
    const RAPYD_API_KEY = process.env.RAPYD_API_KEY; // keep in .env
    const RAPYD_API_SECRET = process.env.RAPYD_API_SECRET;

    // Using built-in fetch (Node 18+)
    const response = await fetch("https://sandboxapi.rapyd.net/v1/data/countries", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access_key": RAPYD_API_KEY,
        "secret_key": RAPYD_API_SECRET
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching countries:", err);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

module.exports = router;
