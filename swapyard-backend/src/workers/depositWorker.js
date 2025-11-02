const { consumeQueue } = require("../services/rabbitmqService");
const { notifyUser } = require("../services/sseService");
const redisClient = require("../services/redisClient");
const MarkupSetting = require("../models/markupSettings");

(async () => {
  await consumeQueue("depositQueue", async (job) => {
    const { userId, amount, currency } = job;

    console.log("💰 Processing deposit:", job);

    // apply markup if configured
    const markup = await MarkupSetting.findOne({ type: "deposit" });
    const markupAmount = markup ? (amount * markup.percentage) / 100 : 0;
    const finalAmount = amount - markupAmount;

    // simulate deposit processing
    await new Promise((r) => setTimeout(r, 2000));

    // notify frontend via SSE
    notifyUser(userId, {
      type: "deposit_complete",
      data: { amount, finalAmount, currency, markupPercent: markup ? markup.percentage : 0 },
    });

    // Redis Pub/Sub cross-instance
    await redisClient.publish(
      "notifications",
      JSON.stringify({
        userId,
        data: { type: "deposit_complete", amount, finalAmount, currency, markupPercent: markup ? markup.percentage : 0 },
      })
    );

    console.log(`✅ Deposit completed for ${userId}`);
  });
})();
