const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: ['payment', 'swap'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },

    sourceAmount: Number,
    sourceCurrency: String,
    targetAmount: Number,
    targetCurrency: String,

    effectiveRate: Number,
    baseRate: Number,

    counterpartyName: String,
    counterpartyAccount: String,
    counterpartyBank: String,

    provider: { type: String, default: 'rapyd' },
    providerRef: { type: String, default: '' },

    meta: {}
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
