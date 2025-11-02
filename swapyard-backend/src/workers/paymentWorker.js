const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");

(async () => {
  await consumeQueue("paymentQueue", async (job) => {
    const { userId, paymentId, amount, currency } = job;
    console.log("💰 Processing payment:", paymentId);

    // Simulate async processing (e.g., verifying webhook, crediting wallet)
    await new Promise((r) => setTimeout(r, 2000));

    // Notify local SSE clients
    notifyUser(userId, {
      type: "payment_success",
      data: { paymentId, amount, currency },
    });

    // Notify other app instances via Redis
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: { type: "payment_success", data: { paymentId, amount, currency } },
      })
    );

    console.log(`✅ Payment processed successfully for ${userId}`);
  });
})();
