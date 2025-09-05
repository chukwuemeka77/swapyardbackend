const router = require('express').Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { rapydRequest } = require('../utils/rapyd');
const { applyHiddenMargin } = require('../services/pricing');

router.post('/swap/quote', auth, async (req, res) => {
  try {
    const { sourceCurrency, targetCurrency, sourceAmount } = req.body;
    if (!sourceCurrency || !targetCurrency || !sourceAmount) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Replace with real Rapyd rate call when account access is ready:
    // const rapydRes = await rapydRequest('GET', `/v1/rates?base_currency=${sourceCurrency}`);
    // const baseRate = rapydRes.data.rates[targetCurrency];
    const baseRate = 0.90; // temp placeholder

    const { effectiveRate } = applyHiddenMargin(baseRate, Number(sourceAmount));
    const targetAmount = Number(sourceAmount) * effectiveRate;

    res.json({
      sourceCurrency,
      targetCurrency,
      sourceAmount: Number(sourceAmount),
      targetAmount: Number(targetAmount.toFixed(2)),
      effectiveRate: Number(effectiveRate.toFixed(6))
    });
  } catch (e) {
    console.error('quote error', e?.response?.data || e.message);
    res.status(500).json({ error: 'Quote failed' });
  }
});

router.post('/pay', auth, async (req, res) => {
  try {
    const { amount, currency, accountNumber, bankCode, accountName } = req.body;
    if (!amount || !currency || !accountNumber || !bankCode) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const tx = await Transaction.create({
      userId: req.user.id,
      type: 'payment',
      status: 'pending',
      sourceAmount: Number(amount),
      sourceCurrency: currency,
      counterpartyName: accountName || '',
      counterpartyAccount: accountNumber,
      counterpartyBank: bankCode
    });

    // Example Rapyd payout call (to enable later):
    // const rapydRes = await rapydRequest('POST', '/v1/payouts', { ... });

    const providerRef = `SIM-${tx._id.toString().slice(-6)}`; // TEMP simulate
    tx.status = 'completed';
    tx.providerRef = providerRef;
    await tx.save();

    notifyUser(req.user.id, {
      type: 'payment',
      title: 'Payment sent',
      body: `You sent ${amount} ${currency} to ${accountName || accountNumber}`,
      txId: tx._id
    });

    res.json({ success: true, transactionId: tx._id, providerRef });
  } catch (e) {
    console.error('pay error', e?.response?.data || e.message);
    res.status(500).json({ error: 'Payment failed' });
  }
});

router.get('/transactions', auth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const items = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ items });
});

/* SSE notification plumbing exposed for notifications router */
let sseClients = {};
function notifyUser(userId, payload) {
  const subs = sseClients[userId];
  if (!subs) return;
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  subs.forEach((res) => res.write(message));
}
router.__notifyUser = notifyUser;
router.__sseClients = sseClients;

module.exports = router;
