const router = require('express').Router();
const auth = require('../middleware/auth');

module.exports = function makeNotificationsRouter(paymentsRouter) {
  const sseClients = paymentsRouter.__sseClients;
  const notifyUser = paymentsRouter.__notifyUser;

  router.get('/stream', auth, (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write('retry: 10000\n\n');

    if (!sseClients[req.user.id]) sseClients[req.user.id] = new Set();
    sseClients[req.user.id].add(res);

    res.write(`data: ${JSON.stringify({ type: 'hello', ts: Date.now() })}\n\n`);

    req.on('close', () => {
      sseClients[req.user.id].delete(res);
      res.end();
    });
  });

  router.post('/send', auth, (req, res) => {
    notifyUser(req.user.id, req.body || { type: 'ping' });
    res.json({ ok: true });
  });

  return router;
};
