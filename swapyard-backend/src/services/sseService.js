const sseClients = {};

function addClient(userId, res) {
  if (!sseClients[userId]) sseClients[userId] = new Set();
  sseClients[userId].add(res);
  res.on("close", () => removeClient(userId, res));
}

function removeClient(userId, res) {
  const set = sseClients[userId];
  if (!set) return;
  set.delete(res);
  if (set.size === 0) delete sseClients[userId];
}

function notifyUser(userId, data) {
  const set = sseClients[userId];
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of Array.from(set)) {
    try {
      res.write(payload);
    } catch {
      removeClient(userId, res);
    }
  }
}

function broadcast(data) {
  for (const userId of Object.keys(sseClients)) {
    notifyUser(userId, data);
  }
}

module.exports = { addClient, notifyUser, removeClient, broadcast, sseClients };
