// Placeholder commercial assumptions — NOT final pricing. Used only to
// decide which savings framing reads as the strongest honest story for a
// given store (see getStoreLeadQualification in metricsEngine.js), not to
// compute any customer-facing financial figure.
export const PRICING_CONFIG = {
  // TODO: replace with confirmed P2/P3 single-store installation estimate
  // once pricing is locked
  estimatedInstallCostTND: 15000,
  // TODO: replace with confirmed recurring monthly fee once the
  // shared-savings / minimum-fee structure is finalized
  recurringMonthlyFeeTND: 350,
  // Margin required before a store's savings are considered a strong
  // lead-with story (must exceed monthly cost by this multiple, not just
  // barely cover it)
  temptingThresholdMultiplier: 1.5,
};
