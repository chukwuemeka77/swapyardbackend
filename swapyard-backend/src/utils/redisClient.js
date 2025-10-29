// src/utils/redisClient.js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.REDIS_PREFIX || "swapyard";

// Generic Upstash REST API wrapper
async function redisRequest(method, endpoint, body = null) {
  const url = `${REST_URL}/${endpoint}`;
  const headers = { Authorization: `Bearer ${REST_TOKEN}` };

  try {
    const response = await axios({
      method,
      url,
      headers,
      data: body,
    });
    return response.data.result;
  } catch (err) {
    console.error(`Redis ${method.toUpperCase()} ${endpoint} error:`, err.message);
    return null;
  }
}

async function redisGet(key) {
  const result = await redisRequest("get", `get/${PREFIX}:${key}`);
  return result ? JSON.parse(result) : null;
}

async function redisSet(key, value, ttlSeconds = 86400) {
  const val = encodeURIComponent(JSON.stringify(value));
  await redisRequest("post", `set/${PREFIX}:${key}/${val}/${ttlSeconds}`);
}

// Optional publish for multi-instance notifications
async function redisPublish(channel, message) {
  await redisRequest("post", `publish/${channel}/${encodeURIComponent(message)}`);
}

export default { get: redisGet, set: redisSet, publish: redisPublish };
