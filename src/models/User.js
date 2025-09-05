const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true },
    phone: { type: String, trim: true, index: true, sparse: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    kycTier: { type: String, enum: ['basic', 'verified', 'ultimate'], default: 'basic' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
    language: { type: String, default: 'en' }
  },
  { timestamps: true }
);

// Removed duplicate index calls; indexes are already defined inline
module.exports = mongoose.model('User', userSchema);
