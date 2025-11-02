// src/services/rabbitmqService.js
const amqp = require("amqplib");

let channel;

/**
 * Connect to RabbitMQ and create a channel.
 */
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("✅ RabbitMQ connected");

    connection.on("error", (err) => {
      console.error("❌ RabbitMQ connection error:", err);
    });

    connection.on("close", () => {
      console.warn("⚠️ RabbitMQ connection closed. Attempting reconnect...");
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (err) {
    console.error("❌ Failed to connect RabbitMQ:", err);
    setTimeout(connectRabbitMQ, 5000);
  }
}

/**
 * Publish a job to a queue.
 */
async function sendToQueue(queue, message) {
  if (!channel) throw new Error("RabbitMQ not connected");
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
  console.log(`📤 Sent to queue "${queue}":`, message);
}

/**
 * Consume jobs from a queue.
 */
async function consumeQueue(queue, handler) {
  if (!channel) throw new Error("RabbitMQ not connected");
  await channel.assertQueue(queue, { durable: true });

  channel.consume(queue, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        await handler(data);
        channel.ack(msg);
      } catch (err) {
        console.error(`❌ Error processing job in ${queue}:`, err);
      }
    }
  });

  console.log(`📥 Listening on queue "${queue}"`);
}

module.exports = { connectRabbitMQ, sendToQueue, consumeQueue };
