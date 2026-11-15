import type { Business } from "./types";
import type { FinancialSummary } from "./calculations";
import type { Risk } from "./risks";
import { roundMoney } from "./money";

export interface RecoveryTask {
  id: string;
  week: 1 | 2 | 3 | 4;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  /** Estimated monthly cash improvement, when one can be calculated */
  estimatedMonthlyImpact: number | null;
}

/** Rule-based 30-day plan. Impact estimates use explicit, labelled percentages. */
export function buildRecoveryPlan(b: Business, s: FinancialSummary, risks: Risk[]): RecoveryTask[] {
  const has = (id: string) => risks.some((r) => r.id === id);
  const tasks: RecoveryTask[] = [];

  tasks.push({
    id: "expense_review",
    week: 1,
    priority: has("expense_growth") || has("negative_cash_flow") ? "high" : "medium",
    title: "Review every fixed expense line",
    detail: "List each recurring cost and mark it as essential, reducible or removable. Target: cut 5% of fixed costs.",
    estimatedMonthlyImpact: roundMoney(b.monthlyFixedCosts * 0.05),
  });
  tasks.push({
    id: "freeze",
    week: 1,
    priority: has("low_reserves") ? "high" : "low",
    title: "Freeze discretionary spending",
    detail: "Pause non-essential purchases and new commitments above your spending threshold until the plan is complete.",
    estimatedMonthlyImpact: null,
  });
  tasks.push({
    id: "collections",
    week: 2,
    priority: "high",
    title: "Collect outstanding customer payments",
    detail: "Contact every customer with an overdue balance, offer simple payment options, and tighten credit terms for new orders.",
    estimatedMonthlyImpact: null,
  });
  if (s.inventoryMonths !== null && s.inventoryMonths > 2) {
    const excess = roundMoney(b.inventoryValue - b.monthlyVariableCosts * 2);
    tasks.push({
      id: "inventory",
      week: 2,
      priority: has("excess_inventory") ? "high" : "medium",
      title: "Turn slow-moving stock back into cash",
      detail: `About ${excess.toLocaleString("en-US")} of stock is above a 2-month level. Discount slow movers and pause reorders on them.`,
      estimatedMonthlyImpact: roundMoney(excess * 0.25),
    });
  }
  tasks.push({
    id: "pricing",
    week: 3,
    priority: has("margin_decline") ? "high" : "medium",
    title: "Reprice low-margin products",
    detail: "Rank products by margin. Raise prices or renegotiate supplier costs on the bottom 20%. Target: +2 points of gross margin.",
    estimatedMonthlyImpact: roundMoney(b.monthlyRevenue * 0.02),
  });
  if (b.monthlyDebtRepayment > 0) {
    tasks.push({
      id: "debt",
      week: 3,
      priority: has("debt_pressure") ? "high" : "low",
      title: "Talk to lenders about repayment terms",
      detail: "Ask about extending the term or a temporary reduced payment to ease monthly pressure.",
      estimatedMonthlyImpact: null,
    });
  }
  tasks.push({
    id: "budget",
    week: 4,
    priority: "medium",
    title: "Set a new monthly operating budget",
    detail: "Use the results of weeks 1–3 to set spending limits per category, then review cash weekly.",
    estimatedMonthlyImpact: null,
  });
  return tasks;
}
