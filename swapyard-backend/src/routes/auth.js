const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

router.post('/signup', async (req, res) => {
  try {
    const { email, phone, password, name } = req.body;
    if ((!email && !phone) || !password) {
      return res.status(400).json({ error: 'Email or phone and password are required' });
    }
    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) return res.status(400).json({ error: 'User already exists' });

    const user = await User.create({
      email: email || undefined,
      phone: phone || undefined,
      passwordHash: hashPassword(password),
      name: name || ''
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: sanitize(user) });
  } catch (e) {
    console.error('Signup error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if (!password || (!email && !phone)) {
      return res.status(400).json({ error: 'Provide email or phone and password' });
    }
    const user = await User.findOne(email ? { email } : { phone });
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: sanitize(user) });
  } catch (e) {
    console.error('Login error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

function sanitize(user) {
  return {
    id: user._id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    balance: user.balance,
    kycTier: user.kycTier,
    theme: user.theme,
    language: user.language,
    profilePicture: user.profilePicture
  };
}

module.exports = router;
