// src/services/rabbitmqService.js
const amqp = require("amqplib");
let channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.CLOUDAMQP_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("withdrawalQueue", { durable: true });
  console.log("✅ RabbitMQ connected and withdrawalQueue asserted");
}

async function sendToWithdrawalQueue(data) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  channel.sendToQueue("withdrawalQueue", Buffer.from(JSON.stringify(data)), { persistent: true });
}

async function consumeQueue(queueName, callback) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  await channel.assertQueue(queueName, { durable: true });
  channel.consume(queueName, async (msg) => {
    if (msg !== null) {
      const data = JSON.parse(msg.content.toString());
      await callback(data);
      channel.ack(msg);
    }
  });
}

module.exports = { connectRabbitMQ, sendToWithdrawalQueue, consumeQueue };
