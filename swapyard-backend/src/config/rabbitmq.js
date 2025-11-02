// src/config/rabbitmq.js
const amqp = require("amqplib");
require("dotenv").config();

let channel = null;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("✅ Connected to RabbitMQ");
    return channel;
  } catch (error) {
    console.error("❌ RabbitMQ connection failed:", error.message);
    process.exit(1);
  }
}

async function getChannel() {
  if (!channel) await connectRabbitMQ();
  return channel;
}

module.exports = { connectRabbitMQ, getChannel };
