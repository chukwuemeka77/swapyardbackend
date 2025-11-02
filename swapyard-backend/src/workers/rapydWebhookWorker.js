// src/workers/rapydWebhookWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../utils/redisClient");

(async () => {
  await consumeQueue("rapydWebhookQueue", async (event) => {
    console.log("⚙️ Processing Rapyd event:", event.type);

    const userId = event?.data?.metadata?.userId || null;

    try {
      switch (event.type) {
        case "payment.completed":
          // Update your DB: mark payment success here
          console.log("💰 Payment completed:", event.data.id);

          if (userId) {
            const message = {
              type: "payment_success",
              data: event.data,
            };

            notifyUser(userId, message);

            await redisClient.publish(
              "notifications",
              JSON.stringify({ userId, data: message })
            );
          }
          break;

        case "wallet.transfer_completed":
          console.log("🏦 Wallet transfer completed:", event.data.id);
          // handle wallet updates etc.
          break;

        default:
          console.log("ℹ️ Unhandled Rapyd event:", event.type);
      }
    } catch (err) {
      console.error("❌ Error processing Rapyd event:", err.message);
      throw err; // causes message to be requeued
    }
  });
})();
