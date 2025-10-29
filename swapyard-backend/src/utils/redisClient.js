// src/utils/redisClient.js
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL,
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
});

redisClient.on("connect", () => console.log("Redis client connected"));
redisClient.on("error", (err) => console.error("Redis error:", err));

// Connect immediately
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Redis connection failed:", err);
  }
})();

export default redisClient;
