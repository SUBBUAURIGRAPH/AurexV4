/**
 * Article 6.4 ER (Emission Reduction) calculation.
 *
 * ER = baseline − project − leakage   (emission-avoidance activities)
 * RR = project_removals − baseline_removals − leakage   (removal activities)
 *
 * Conservativeness discount is applied if declared (e.g. 5% means the
 * claimed ER is reduced by 5% to stay on the conservative side of
 * uncertainty — per A6.4-STAN-METH-004 §conservativeness principle).
 *
 * All values in tCO2e. Rounded DOWN to whole tCO2e at issuance (§fractional
 * units don't exist in the registry).
 */

export interface ErInputs {
  baselineEmissions: number;        // tCO2e
  projectEmissions: number;         // tCO2e
  leakageEmissions: number;         // tCO2e
  conservativenessPct?: number;     // 0-100
  isRemoval?: boolean;
}

export interface ErResult {
  grossEr: number;                  // pre-conservativeness, pre-rounding
  conservativenessDiscount: number; // the tCO2e removed by the discount
  netEr: number;                    // rounded-down whole tCO2e — the claimable amount
  formula: string;                  // human-readable
}

export function calculateEr(inputs: ErInputs): ErResult {
  if (inputs.baselineEmissions < 0 || inputs.projectEmissions < 0 || inputs.leakageEmissions < 0) {
    throw new Error('ER inputs must be non-negative');
  }
  if (inputs.conservativenessPct !== undefined) {
    if (inputs.conservativenessPct < 0 || inputs.conservativenessPct > 100) {
      throw new Error('conservativenessPct must be between 0 and 100');
    }
  }

  const gross = inputs.baselineEmissions - inputs.projectEmissions - inputs.leakageEmissions;
  const grossEr = Math.max(0, gross); // never negative — no ER if project > baseline
  const discountPct = (inputs.conservativenessPct ?? 0) / 100;
  const conservativenessDiscount = grossEr * discountPct;
  const afterDiscount = grossEr - conservativenessDiscount;
  const netEr = Math.floor(afterDiscount); // A6.4 registry requires whole tCO2e
  const formula = inputs.isRemoval
    ? 'RR = project_removals − baseline_removals − leakage (conservative)'
    : 'ER = baseline − project − leakage (conservative)';
  return { grossEr, conservativenessDiscount, netEr, formula };
}
