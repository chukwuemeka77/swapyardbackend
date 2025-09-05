const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: user._id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    balance: user.balance,
    kycTier: user.kycTier,
    theme: user.theme,
    language: user.language,
    profilePicture: user.profilePicture
  });
});

router.patch('/preferences', auth, async (req, res) => {
  const { theme, language } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { ...(theme ? { theme } : {}), ...(language ? { language } : {}) },
    { new: true }
  );
  res.json({ theme: user.theme, language: user.language });
});

module.exports = router;
