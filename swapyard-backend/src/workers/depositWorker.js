// src/workers/depositWorker.js
const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../utils/redisClient");

// connect and start consuming
(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency } = job;
    console.log("💰 Processing deposit:", job);

    // simulate long task
    await new Promise((r) => setTimeout(r, 2000));

    // Notify user via SSE
    notifyUser(userId, {
      type: "deposit_complete",
      data: { amount, currency },
    });

    // Publish to Redis Pub/Sub for cross-instance
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: {
          type: "deposit_complete",
          data: { amount, currency },
        },
      })
    );

    console.log(`✅ Deposit completed for ${userId}`);
  });
})();
