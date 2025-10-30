// src/services/redisPubSub.js
const { createClient } = require("redis");
const { client: redisClient, connectRedis } = require("./redisClient");

let notifyUser = null;

function setNotifyUser(fn) {
  notifyUser = fn;
}

// Create a duplicate client for subscriptions
let subscriber;
async function subscribeNotifications() {
  subscriber = redisClient.duplicate();
  subscriber.on("error", (err) => console.error("❌ Redis Subscriber Error:", err));
  await subscriber.connect();

  await subscriber.subscribe("notifications", (message) => {
    try {
      const { userId, data } = JSON.parse(message);
      if (notifyUser) notifyUser(userId, data);
    } catch (err) {
      console.error("Redis parse error:", err);
    }
  });

  console.log("✅ Redis subscription ready");
}

async function publishNotification(userId, data) {
  try {
    await redisClient.publish("notifications", JSON.stringify({ userId, data }));
  } catch (err) {
    console.error("Redis publish error:", err);
  }
}

module.exports = { connectRedis, subscribeNotifications, publishNotification, setNotifyUser };
