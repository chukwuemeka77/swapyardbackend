// src/queues/depositQueue.js
const { getChannel } = require("../config/rabbitmq");
const QUEUE_NAME = "deposit_queue";

async function publishDepositJob(depositData) {
  const channel = await getChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(depositData)));
  console.log("📨 Deposit job queued:", depositData.transactionId);
}

module.exports = { publishDepositJob, QUEUE_NAME };
