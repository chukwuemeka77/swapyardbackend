// src/routes/rapydWebhookRoutes.js
const router = require("express").Router();
const { notifyUser } = require("../services/sseService");

// ✅ Rapyd sends POST requests here
router.post("/", async (req, res) => {
  try {
    const event = req.body;

    console.log("Received Rapyd webhook:", event.type);

    // Example: extract userId from metadata (depends on how you create payments)
    const userId = event?.data?.metadata?.userId;

    if (userId) {
      // Forward the event via SSE to the correct user
      notifyUser(userId, {
        type: "rapyd_event",
        event: event.type,
        data: event.data,
      });
    }

    // Always reply quickly to Rapyd (they expect 200)
    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Error handling Rapyd webhook:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
