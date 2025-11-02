// src/utils/markupCalculator.js
const ExchangeRate = require("../models/ExchangeRate");

const DEFAULT_MARKUP = parseFloat(process.env.MARKUP_PERCENT_DEFAULT || "0.02"); // 2% default

/**
 * Get base rate and markupPercent for a currency pair.
 * Returns { baseRate, markupPercent }.
 * baseRate may be null if not found.
 */
async function getRateAndMarkup(pair) {
  const doc = await ExchangeRate.findOne({ pair, active: true }).lean();
  if (doc) {
    return {
      baseRate: doc.rate,
      markupPercent: typeof doc.markupPercent === "number" ? doc.markupPercent : (doc.markupPercent === null ? DEFAULT_MARKUP : DEFAULT_MARKUP),
      source: "db",
    };
  }
  // Not found in DB — fallback to env default (baseRate null -> caller should handle)
  return { baseRate: null, markupPercent: DEFAULT_MARKUP, source: "env" };
}

/**
 * Apply markup to a base rate.
 * Returns { effectiveRate, profitPerUnit }.
 * effectiveRate = baseRate * (1 - markupPercent)
 */
function applyMarkup(baseRate, markupPercent) {
  const effectiveRate = baseRate * (1 - markupPercent);
  const profitPerUnit = baseRate - effectiveRate;
  return { effectiveRate, profitPerUnit };
}

module.exports = { getRateAndMarkup, applyMarkup };
