const amqp = require("amqplib");
let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("✅ RabbitMQ connected");
  } catch (err) {
    console.error("❌ RabbitMQ connection error:", err.message);
  }
}

async function assertQueue(queue) {
  if (!channel) throw new Error("RabbitMQ not connected");
  await channel.assertQueue(queue, { durable: true });
}

async function sendToQueue(queue, msg) {
  if (!channel) throw new Error("RabbitMQ not connected");
  await assertQueue(queue);
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(msg)), { persistent: true });
}

async function consumeQueue(queue, callback) {
  if (!channel) throw new Error("RabbitMQ not connected");
  await assertQueue(queue);
  channel.consume(queue, async (msg) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      try {
        await callback(data);
        channel.ack(msg);
      } catch (err) {
        console.error("❌ Worker error:", err.message);
        channel.nack(msg, false, true);
      }
    }
  });
}

module.exports = { connectRabbitMQ, sendToQueue, consumeQueue };
