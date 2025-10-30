// redisPubSub.js
// Handles Redis Pub/Sub for multi-instance notifications

const { createClient } = require("redis");
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  throw new Error("Missing REDIS_URL in environment variables");
}

const pubClient = createClient({ url: redisUrl });
const subClient = createClient({ url: redisUrl });

pubClient.on("error", (err) => console.error("Redis PUB error:", err));
subClient.on("error", (err) => console.error("Redis SUB error:", err));

async function connectRedis() {
  await pubClient.connect();
  await subClient.connect();
  console.log("✅ Redis clients connected");

  // Example: subscribe to 'notifications' channel
  await subClient.subscribe("notifications", (message) => {
    try {
      const { userId, data } = JSON.parse(message);
      // This will call the SSE notifier from notificationRoutes
      if (notifyUser) notifyUser(userId, data);
    } catch (err) {
      console.error("Error parsing Redis message:", err);
    }
  });
}

let notifyUser = null; // will be set from notificationRoutes

function setNotifyUser(fn) {
  notifyUser = fn;
}

async function publishNotification(userId, data) {
  await pubClient.publish(
    "notifications",
    JSON.stringify({ userId, data })
  );
}

module.exports = { connectRedis, publishNotification, setNotifyUser };
