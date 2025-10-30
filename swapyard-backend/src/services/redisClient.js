// src/services/redisClient.js
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;
const PREFIX = process.env.REDIS_PREFIX || "swapyard";

let redisClient;
let subscriber;
let notifyUserCallback = null;

/**
 * Initialize Redis client
 */
export async function connectRedis() {
  redisClient = createClient({
    url: REDIS_URL,
    password: REDIS_PASSWORD,
  });

  redisClient.on("error", (err) => console.error("❌ Redis error:", err));
  redisClient.on("connect", () => console.log("✅ Redis connected"));

  await redisClient.connect();

  // Subscriber for Pub/Sub
  subscriber = redisClient.duplicate();
  await subscriber.connect();

  subscriber.subscribe("notifications", (message) => {
    try {
      const parsed = JSON.parse(message);
      if (notifyUserCallback && parsed.userId && parsed.data) {
        notifyUserCallback(parsed.userId, parsed.data);
      }
    } catch (err) {
      console.error("❌ Redis subscriber parse error:", err);
    }
  });

  console.log("🔔 Redis subscriber ready");
}

/**
 * Set callback for notifying local SSE clients
 * @param {function} cb - (userId, data) => void
 */
export function setNotifyUser(cb) {
  notifyUserCallback = cb;
}

/**
 * Publish a notification to all instances
 * @param {string} userId
 * @param {object} data
 */
export async function publishNotification(userId, data) {
  if (!redisClient) throw new Error("Redis not connected");
  await redisClient.publish(
    "notifications",
    JSON.stringify({ userId, data })
  );
}

/**
 * Cache a key with TTL (seconds)
 * @param {string} key
 * @param {any} value
 * @param {number} ttl
 */
export async function redisSet(key, value, ttl = 86400) {
  if (!redisClient) throw new Error("Redis not connected");
  await redisClient.set(`${PREFIX}:${key}`, JSON.stringify(value), {
    EX: ttl,
  });
}

/**
 * Get cached key
 * @param {string} key
 * @returns {any}
 */
export async function redisGet(key) {
  if (!redisClient) throw new Error("Redis not connected");
  const result = await redisClient.get(`${PREFIX}:${key}`);
  return result ? JSON.parse(result) : null;
}

export default {
  connectRedis,
  setNotifyUser,
  publishNotification,
  redisSet,
  redisGet,
};
