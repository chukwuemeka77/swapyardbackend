const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

router.get("/", async (req, res) => {
  try {
    const response = await fetch("https://sandboxapi.rapyd.net/v1/data/countries", {
      headers: {
        "Content-Type": "application/json",
        "access_key": process.env.RAPYD_API_KEY, // secret in backend
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Countries fetch error:", err);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

module.exports = router;
