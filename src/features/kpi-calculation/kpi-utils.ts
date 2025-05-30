// KPI Calculation Utilities for FinCo
// DRY: All bonus/penalty and score calculation logic is here

export interface KpiWeights {
  responseTime: number;
  reportSubmission: number;
  attendance: number;
  quality: number;
}

export interface KpiBonusesPenalties {
  bonusAmount: number;
  penaltyAmount: number;
}

/**
 * Calculate the final weighted KPI score
 * @param metrics - KPI metrics (responseTime, reportSubmission, attendance, quality)
 * @param weights - Weights for each metric
 */
export function calculateTotalScore(
  metrics: Record<string, any>,
  weights: KpiWeights
): number {
  return (
    (metrics.responseTime || 0) * weights.responseTime +
    (metrics.reportSubmission || 0) * weights.reportSubmission +
    (metrics.attendance || 0) * weights.attendance +
    (metrics.quality || 0) * weights.quality
  );
}

/**
 * Calculate bonuses and penalties based on total score and base salary
 * @param totalScore - Final KPI score (0-100)
 * @param baseSalary - User's base salary
 */
export function calculateBonusesAndPenalties(
  totalScore: number,
  baseSalary: number
): KpiBonusesPenalties {
  if (totalScore >= 95) {
    return { bonusAmount: baseSalary * 0.2, penaltyAmount: 0 };
  } else if (totalScore >= 85) {
    return { bonusAmount: baseSalary * 0.1, penaltyAmount: 0 };
  } else if (totalScore >= 70) {
    return { bonusAmount: 0, penaltyAmount: 0 };
  } else if (totalScore >= 60) {
    return { bonusAmount: 0, penaltyAmount: baseSalary * 0.1 };
  } else {
    return { bonusAmount: 0, penaltyAmount: baseSalary * 0.2 };
  }
}
