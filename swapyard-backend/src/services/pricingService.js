// Tiered hidden margin based on source amount
function getMarginPercent(amount) {
  if (amount < 100) return 0.01;       // 1.0%
  if (amount <= 1000) return 0.0075;   // 0.75%
  return 0.005;                        // 0.5%
}

function applyHiddenMargin(baseRate, amount) {
  const marginPct = getMarginPercent(amount);
  const effectiveRate = baseRate * (1 - marginPct);
  return { effectiveRate, marginPct };
}

module.exports = { getMarginPercent, applyHiddenMargin };
