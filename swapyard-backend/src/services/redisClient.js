// src/services/redisClient.js
const { createClient } = require("redis");

let redisClient;
let subscriber;
let notifyUserCallback = () => {};

function setNotifyUser(cb) {
  notifyUserCallback = cb;
}

async function connectRedis() {
  redisClient = createClient({ url: process.env.REDIS_URL });
  subscriber = redisClient.duplicate();

  redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));
  subscriber.on("error", (err) => console.error("❌ Redis Subscriber Error:", err));

  await redisClient.connect();
  await subscriber.connect();

  console.log("✅ Redis connected");

  // Subscribe to notifications channel
  await subscriber.subscribe("notifications", (message) => {
    try {
      const { userId, payload } = JSON.parse(message);
      notifyUserCallback(userId, payload);
    } catch (err) {
      console.error("❌ Redis parse error:", err);
    }
  });
}

async function publishNotification(userId, payload) {
  if (!redisClient) throw new Error("Redis not connected");
  await redisClient.publish(
    "notifications",
    JSON.stringify({ userId, payload })
  );
}

async function setCache(key, value, ttl = 3600) {
  if (!redisClient) throw new Error("Redis not connected");
  await redisClient.set(key, JSON.stringify(value), { EX: ttl });
}

async function getCache(key) {
  if (!redisClient) throw new Error("Redis not connected");
  const val = await redisClient.get(key);
  return val ? JSON.parse(val) : null;
}

module.exports = {
  connectRedis,
  publishNotification,
  setNotifyUser,
  setCache,
  getCache,
};
