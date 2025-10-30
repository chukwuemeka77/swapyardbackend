// src/services/redisClient.js
const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const client = createClient({ url: REDIS_URL });

client.on("error", (err) => console.error("❌ Redis Client Error:", err));

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log("✅ Redis client connected");
  }
}

async function get(key) {
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error("Redis GET error:", err);
    return null;
  }
}

async function set(key, value, ttlSeconds = 86400) {
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.error("Redis SET error:", err);
  }
}

module.exports = { client, connectRedis, get, set };
