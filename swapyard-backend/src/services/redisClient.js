// src/services/redisClient.js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.REDIS_PREFIX || "swapyard";

/**
 * Get value from Redis (Upstash REST)
 */
async function redisGet(key) {
  try {
    const response = await axios.get(`${REST_URL}/get/${PREFIX}:${key}`, {
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
    });
    return response.data.result ? JSON.parse(response.data.result) : null;
  } catch (err) {
    console.error("Redis GET error:", err.message);
    return null;
  }
}

/**
 * Set value in Redis with TTL (default 24h)
 */
async function redisSet(key, value, ttlSeconds = 86400) {
  try {
    await axios.post(
      `${REST_URL}/set/${PREFIX}:${key}/${encodeURIComponent(JSON.stringify(value))}/${ttlSeconds}`,
      {},
      { headers: { Authorization: `Bearer ${REST_TOKEN}` } }
    );
  } catch (err) {
    console.error("Redis SET error:", err.message);
  }
}

export default { get: redisGet, set: redisSet };
