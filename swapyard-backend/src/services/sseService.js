// src/services/sseService.js
// Lightweight SSE service using in-memory sets per user.
// Keeps API compatible with your existing code: addClient, notifyUser, sseClients.

const sseClients = {}; // { userId: Set(res, res, ...) }

/**
 * Add a new SSE client (response stream) for a user.
 * @param {string} userId
 * @param {object} res - Express response (SSE)
 */
function addClient(userId, res) {
  if (!sseClients[userId]) sseClients[userId] = new Set();
  sseClients[userId].add(res);
  console.log(`📡 SSE: added client for user ${userId} (total: ${sseClients[userId].size})`);

  // optional guard: if connection closes unexpectedly, remove it
  res.on("close", () => {
    removeClient(userId, res);
  });
}

/**
 * Remove a specific client response for a user.
 * @param {string} userId
 * @param {object} res
 */
function removeClient(userId, res) {
  const set = sseClients[userId];
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    delete sseClients[userId];
  }
  console.log(`🔌 SSE: removed client for user ${userId} (remaining: ${set ? set.size : 0})`);
}

/**
 * Notify all connected clients for a user.
 * Automatically removes clients that error on write.
 * @param {string} userId
 * @param {object} data
 */
function notifyUser(userId, data) {
  const set = sseClients[userId];
  if (!set || set.size === 0) {
    // no connected clients
    return;
  }

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of Array.from(set)) {
    try {
      // If the response is already finished, an error will be thrown - catch & remove
      res.write(payload);
    } catch (err) {
      console.warn(`⚠️ SSE write error for user ${userId}:`, err.message || err);
      // cleanup this broken client
      try {
        removeClient(userId, res);
      } catch (e) {
        // ignore
      }
    }
  }
}

/**
 * Broadcast to all connected users (useful for system-wide alerts).
 * @param {object} data
 */
function broadcast(data) {
  for (const userId of Object.keys(sseClients)) {
    notifyUser(userId, data);
  }
}

module.exports = { addClient, notifyUser, removeClient, broadcast, sseClients };
