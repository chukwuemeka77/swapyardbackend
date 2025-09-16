const sseClients = {};

function addClient(userId, res) {
  if (!sseClients[userId]) sseClients[userId] = new Set();
  sseClients[userId].add(res);
}

function notifyUser(userId, data) {
  if (!sseClients[userId]) return;
  for (const client of sseClients[userId]) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

module.exports = { addClient, notifyUser, sseClients };
