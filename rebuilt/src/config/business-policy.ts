/** Keputusan eksplisit pengguna, 19 Oktober 2026. Bukan mesin kalkulasi domain. */
export const businessPolicy = {
  report: {
    version: "RAPOR-1.0",
    weights: { ph: 20, ats: 30, asas: 50 },
    practice: "display-separately",
  },
  withdrawalFee: {
    version: "FEE-1.0",
    rounding: "nearest-thousand-half-up",
    balanceDebit: "withdrawal-amount",
    cashReceived: "withdrawal-amount-minus-fee",
  },
  survey: {
    version: "SURVEI-REQUIRED-1.0",
    essayRequirements: "legacy-backend-required-list",
    peerEssayRequired: false,
    sharedStepAndFinalValidation: true,
  },
  openDecisions: ["D10: pembaruan KKM dan arsip rapor"],
} as const;
