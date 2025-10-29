// swapyard-backend/src/services/redisClient.js
const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient
  .connect()
  .then(() => console.log("Redis connected successfully"))
  .catch((err) => console.error("Redis connection error:", err));

module.exports = redisClient;
