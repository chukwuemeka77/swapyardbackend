// src/services/redisPubSub.js
const { createClient } = require("redis");

let notifyUserCallback = null;
let subscriber;
let publisher;

/**
 * Link local SSE notifier
 * @param {function} callback - function(userId, data)
 */
function setNotifyUser(callback) {
  notifyUserCallback = callback;
}

/**
 * Publish a notification to Redis channel
 * @param {string} userId
 * @param {object} data
 */
async function publishNotification(userId, data) {
  if (!publisher) throw new Error("Redis publisher not connected");
  await publisher.publish("notifications", JSON.stringify({ userId, data }));
}

/**
 * Connect to Redis (pub/sub) and subscribe to notifications
 */
async function connectRedis() {
  const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

  // Publisher
  publisher = createClient({ url: REDIS_URL });
  publisher.on("error", (err) => console.error("Redis publisher error:", err));
  await publisher.connect();

  // Subscriber
  subscriber = createClient({ url: REDIS_URL });
  subscriber.on("error", (err) => console.error("Redis subscriber error:", err));
  await subscriber.connect();

  await subscriber.subscribe("notifications", (message) => {
    try {
      const { userId, data } = JSON.parse(message);
      if (notifyUserCallback && userId && data) {
        notifyUserCallback(userId, data);
      }
    } catch (err) {
      console.error("Failed to parse Redis notification:", err);
    }
  });

  console.log("✅ Redis pub/sub connected and listening for notifications");
}

module.exports = { connectRedis, publishNotification, setNotifyUser };
