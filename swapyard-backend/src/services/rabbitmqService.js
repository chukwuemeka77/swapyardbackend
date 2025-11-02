// src/services/rabbitmqService.js
import amqp from "amqplib";

let channel;

/**
 * Connect to RabbitMQ and create a channel.
 */
export async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("✅ RabbitMQ connected");
  } catch (err) {
    console.error("❌ RabbitMQ connection error:", err);
  }
}

/**
 * Send a message to a queue (producer).
 * @param {string} queue - Queue name
 * @param {object} message - Object to send
 */
export async function sendToQueue(queue, message) {
  if (!channel) throw new Error("RabbitMQ not initialized");
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
  console.log(`📤 Sent to queue "${queue}":`, message);
}

/**
 * Consume messages from a queue (worker).
 * @param {string} queue - Queue name
 * @param {function} handler - Async function to handle messages
 */
export async function consumeQueue(queue, handler) {
  if (!channel) throw new Error("RabbitMQ not initialized");
  await channel.assertQueue(queue, { durable: true });
  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const data = JSON.parse(msg.content.toString());
        await handler(data);
        channel.ack(msg);
      } catch (err) {
        console.error(`❌ Error processing ${queue}:`, err);
      }
    }
  });
}
