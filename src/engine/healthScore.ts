import type { Business } from "./types";
import { summarize, trendPct, type FinancialSummary } from "./calculations";
import { clamp, formatPct, roundTo } from "./money";

export type DimensionKey = "liquidity" | "profitability" | "debt" | "expenses" | "growth" | "inventory";

export interface DimensionScore {
  key: DimensionKey;
  label: string;
  weight: number;
  /** 0–100 */
  score: number;
  method: string;
  evidence: string[];
  trend: "improving" | "deteriorating" | "stable" | "unknown";
  improveAction: string;
}

export interface HealthScore {
  total: number;
  grade: "Strong" | "Stable" | "Vulnerable" | "Critical";
  dimensions: DimensionScore[];
}

/** Linear map of x from [x0, x1] onto [0, 100], clamped. */
function scale(x: number, x0: number, x1: number): number {
  return clamp(((x - x0) / (x1 - x0)) * 100, 0, 100);
}

function trendOf(pct: number | null, higherIsBetter = true): DimensionScore["trend"] {
  if (pct === null) return "unknown";
  if (Math.abs(pct) < 2) return "stable";
  return (pct > 0) === higherIsBetter ? "improving" : "deteriorating";
}

export function computeHealthScore(b: Business, s: FinancialSummary = summarize(b)): HealthScore {
  const h = b.history ?? [];
  const revTrend = trendPct(h.map((m) => m.revenue));
  const expTrend = trendPct(h.map((m) => m.variableCosts + m.fixedCosts + m.debtRepayment));
  const cashTrend = trendPct(h.map((m) => m.closingCash));
  const marginTrend = trendPct(h.map((m) => (m.revenue > 0 ? ((m.revenue - m.variableCosts) / m.revenue) * 100 : 0)));
  const dims: DimensionScore[] = [];

  // 1. Liquidity: 6+ months of essential-expense reserve = 100, 0 months = 0.
  {
    const rm = s.reserveMonths ?? 6;
    let score = scale(rm, 0, 6);
    if (s.runway.kind === "runway") score = Math.min(score, scale(s.runway.months, 0, 12));
    if (s.runway.kind === "no_cash") score = 0;
    dims.push({
      key: "liquidity",
      label: "Cash flow & liquidity",
      weight: 25,
      score,
      method: "Months of essential expenses (fixed costs + debt repayments) covered by cash: 0 months = 0, 6+ months = 100. Capped by cash runway if the business is burning cash.",
      evidence: [
        `Cash on hand: ${s.cash.toLocaleString("en-US")}`,
        `Essential monthly expenses: ${s.essentialMonthly.toLocaleString("en-US")}`,
        `Reserve coverage: ${s.reserveMonths ?? "n/a"} months`,
        s.runway.kind === "positive_cash_flow" ? "Operating cash flow is positive" : `Monthly burn: ${s.runway.monthlyBurn.toLocaleString("en-US")}`,
      ],
      trend: trendOf(cashTrend),
      improveAction: "Build reserves toward 3–6 months of essential expenses before committing to large outlays.",
    });
  }

  // 2. Profitability: net margin −10% = 0, +20% = 100.
  {
    const nm = s.netMarginPct ?? -10;
    dims.push({
      key: "profitability",
      label: "Profitability",
      weight: 25,
      score: scale(nm, -10, 20),
      method: "Net operating margin: −10% or worse = 0, +20% or better = 100, linear in between.",
      evidence: [
        `Net operating profit: ${s.netProfit.toLocaleString("en-US")} / month`,
        `Net margin: ${s.netMarginPct === null ? "n/a" : formatPct(s.netMarginPct)}`,
        `Gross margin: ${s.grossMarginPct === null ? "n/a" : formatPct(s.grossMarginPct)}`,
      ],
      trend: trendOf(marginTrend),
      improveAction: "Review pricing on low-margin products and cut fixed costs that don't drive sales.",
    });
  }

  // 3. Debt exposure: debt service 0% of revenue = 100, 25%+ = 0.
  {
    const dsr = s.debtServiceRatioPct ?? (b.monthlyDebtRepayment > 0 ? 100 : 0);
    const debtToAnnualRevenue = b.monthlyRevenue > 0 ? b.outstandingDebt / (b.monthlyRevenue * 12) : b.outstandingDebt > 0 ? 1 : 0;
    const score = Math.min(100 - scale(dsr, 0, 25), 100 - scale(debtToAnnualRevenue, 0, 0.75));
    dims.push({
      key: "debt",
      label: "Debt exposure",
      weight: 15,
      score,
      method: "Lower of two sub-scores: debt repayments as % of revenue (0% = 100, 25%+ = 0) and outstanding debt vs annual revenue (0 = 100, 75%+ = 0).",
      evidence: [
        `Monthly repayments: ${b.monthlyDebtRepayment.toLocaleString("en-US")} (${formatPct(dsr)} of revenue)`,
        `Outstanding debt: ${b.outstandingDebt.toLocaleString("en-US")} (${formatPct(debtToAnnualRevenue * 100)} of annual revenue)`,
      ],
      trend: "unknown",
      improveAction: "Avoid new borrowing until repayments fall below ~15% of monthly revenue.",
    });
  }

  // 4. Expense control: expense growth vs revenue growth, or expense ratio if no history.
  {
    let score: number;
    const evidence: string[] = [];
    if (revTrend !== null && expTrend !== null) {
      const gap = expTrend - revTrend; // positive = expenses outpacing revenue
      score = 100 - scale(gap, 0, 15);
      evidence.push(`Revenue trend (last 3 vs prior 3 months): ${formatPct(revTrend)}`, `Expense trend: ${formatPct(expTrend)}`);
    } else {
      const ratio = b.monthlyRevenue > 0 ? (s.totalExpenses / b.monthlyRevenue) * 100 : 100;
      score = 100 - scale(ratio, 70, 100);
      evidence.push(`Expenses are ${formatPct(ratio)} of revenue (no 6-month history yet)`);
    }
    dims.push({
      key: "expenses",
      label: "Expense control",
      weight: 15,
      score,
      method: "Gap between expense growth and revenue growth over the last 3 vs previous 3 months: 0 or less = 100, 15 points or more = 0. Without history, uses expenses as % of revenue (70% = 100, 100% = 0).",
      evidence,
      trend: expTrend === null || revTrend === null ? "unknown" : trendOf(revTrend - expTrend),
      improveAction: "Freeze non-essential spending increases until revenue growth catches up.",
    });
  }

  // 5. Growth sustainability: revenue trend −10% = 0, +10% = 100; penalised if growth comes with losses.
  {
    const evidence: string[] = [];
    let score: number;
    if (revTrend !== null) {
      score = scale(revTrend, -10, 10);
      evidence.push(`Revenue trend: ${formatPct(revTrend)}`);
    } else {
      score = b.monthlySalesTarget > 0 ? scale(b.monthlyRevenue / b.monthlySalesTarget, 0.5, 1) : 50;
      evidence.push(`Revenue is ${b.monthlySalesTarget > 0 ? formatPct((b.monthlyRevenue / b.monthlySalesTarget) * 100) : "n/a"} of sales target`);
    }
    if (s.netProfit < 0) {
      score = Math.min(score, 40);
      evidence.push("Growth is not self-funding: the business is loss-making");
    }
    dims.push({
      key: "growth",
      label: "Growth sustainability",
      weight: 10,
      score,
      method: "Revenue trend (last 3 vs prior 3 months): −10% = 0, +10% = 100. Capped at 40 when the business is loss-making. Without history, uses revenue vs sales target.",
      evidence,
      trend: trendOf(revTrend),
      improveAction: "Grow from profitable products first so growth funds itself.",
    });
  }

  // 6. Inventory efficiency: months of inventory vs monthly COGS. ≤1.5 = 100, ≥6 = 0.
  {
    const im = s.inventoryMonths;
    dims.push({
      key: "inventory",
      label: "Inventory efficiency",
      weight: 10,
      score: im === null ? (b.inventoryValue > 0 ? 0 : 100) : 100 - scale(im, 1.5, 6),
      method: "Inventory value ÷ monthly variable costs (used as cost of goods sold) = months of stock. 1.5 months or less = 100, 6+ months = 0. Assumption: variable costs approximate COGS.",
      evidence: [
        `Inventory value: ${b.inventoryValue.toLocaleString("en-US")}`,
        `Months of stock on hand: ${im ?? "n/a"}`,
      ],
      trend: "unknown",
      improveAction: "Discount slow-moving stock and reorder in smaller batches to free up cash.",
    });
  }

  for (const d of dims) d.score = Math.round(d.score);
  const total = Math.round(dims.reduce((acc, d) => acc + (d.score * d.weight) / 100, 0));
  const grade = total >= 75 ? "Strong" : total >= 55 ? "Stable" : total >= 35 ? "Vulnerable" : "Critical";
  return { total: roundTo(total, 0), grade, dimensions: dims };
}
