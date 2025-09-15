const express = require("express");
const router = express.Router();

// Using Node 18+ fetch (no node-fetch needed)
router.get("/", async (req, res) => {
  try {
    const RAPYD_API_KEY = process.env.RAPYD_API_KEY;
    const RAPYD_API_SECRET = process.env.RAPYD_API_SECRET;

    // Call Rapyd API
    const response = await fetch("https://sandboxapi.rapyd.net/v1/data/countries", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access_key": RAPYD_API_KEY,
        "secret_key": RAPYD_API_SECRET
      }
    });

    if (!response.ok) {
      console.error("Rapyd countries fetch failed:", response.status, await response.text());
      return res.status(500).json({ error: "Failed to fetch countries" });
    }

    const rapydData = await response.json();

    // Rapyd wraps countries in rapydData.data
    res.json({ countries: rapydData.data || [] });
  } catch (err) {
    console.error("Error in /countries route:", err);
    res.status(500).json({ error: "Server error fetching countries" });
  }
});

module.exports = router;

