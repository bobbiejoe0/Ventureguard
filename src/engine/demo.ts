import type { Business, MonthlySnapshot } from "./types";

/**
 * Fictional demo company. Revenue 3.5M, total outflows 2.8M, surplus 700k.
 * Essential expenses (fixed + debt) = 1.05M, so 5M cash is ~4.8 months of reserve today.
 */
export function novaRetailHistory(): MonthlySnapshot[] {
  const rows: [string, number, number, number, number][] = [
    // month, revenue, variable, fixed, closing cash
    // Closing cash = previous closing cash + monthly net (debt repayment 150k)
    ["2026-05", 3_300_000, 1_620_000, 780_000, 1_460_000],
    ["2026-06", 3_350_000, 1_650_000, 800_000, 2_210_000],
    ["2026-07", 3_380_000, 1_680_000, 820_000, 2_940_000],
    ["2026-08", 3_420_000, 1_710_000, 880_000, 3_620_000],
    ["2026-09", 3_460_000, 1_740_000, 890_000, 4_300_000],
    ["2026-10", 3_500_000, 1_750_000, 900_000, 5_000_000],
  ];
  return rows.map(([month, revenue, variableCosts, fixedCosts, closingCash]) => ({
    month,
    revenue,
    variableCosts,
    fixedCosts,
    debtRepayment: 150_000,
    closingCash,
  }));
}

export function novaRetail(ownerId = "demo", now = "2026-11-01T00:00:00.000Z"): Business {
  return {
    id: ownerId,
    ownerId,
    name: "Nova Retail",
    industry: "Retail",
    businessType: "Supermarket & household goods",
    country: "Nigeria",
    currency: "NGN",
    employees: 9,
    branches: 1,
    businessAgeYears: 4,
    monthlyRevenue: 3_500_000,
    monthlyVariableCosts: 1_750_000,
    monthlyFixedCosts: 900_000,
    cashBalance: 5_000_000,
    outstandingDebt: 2_400_000,
    monthlyDebtRepayment: 150_000,
    inventoryValue: 4_200_000,
    monthlySalesTarget: 4_000_000,
    goals: ["expand_operations", "increase_profitability"],
    history: novaRetailHistory(),
    createdAt: now,
    updatedAt: now,
  };
}

/** The flagship demo decision: a second branch. */
export const NOVA_BRANCH_INPUTS = {
  investment: 2_000_000,
  monthlyRevenue: 1_200_000,
  variableCostPct: 50,
  monthlyFixed: 450_000,
};
