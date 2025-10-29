// src/services/redisPubSub.js
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const PUBSUB_URL = process.env.UPSTASH_REDIS_REST_URL;
const PUBSUB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Publisher & subscriber clients
const publisher = new Redis(PUBSUB_URL, { password: PUBSUB_TOKEN });
const subscriber = new Redis(PUBSUB_URL, { password: PUBSUB_TOKEN });

export { publisher, subscriber };
