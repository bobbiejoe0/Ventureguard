import type { Business, BusinessPolicy, Severity } from "./types";
import { summarize, trendPct, type FinancialSummary } from "./calculations";
import { evaluatePolicies } from "./policies";
import { formatPct, roundTo } from "./money";

export interface Risk {
  id: string;
  title: string;
  severity: Severity;
  evidence: string[];
  consequence: string;
  action: string;
  detectedAt: string;
}

/** Explicit, tunable thresholds. Risk levels never come from an AI model. */
export const RISK_THRESHOLDS = {
  expenseGrowthGapPct: { medium: 3, high: 8, critical: 15 },
  reserveMonths: { critical: 1, high: 2, medium: 3 },
  marginDeclinePts: { medium: 2, high: 5 },
  debtServicePct: { medium: 12, high: 20, critical: 30 },
  inventoryMonths: { medium: 3, high: 5 },
  salesDeclinePct: { medium: 3, high: 10, critical: 20 },
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function tier<T extends Record<string, number>>(value: number, t: T, higherIsWorse = true): Severity | null {
  const levels: Severity[] = ["critical", "high", "medium", "low"];
  for (const lvl of levels) {
    const limit = t[lvl as keyof T] as number | undefined;
    if (limit === undefined) continue;
    if (higherIsWorse ? value >= limit : value < limit) return lvl;
  }
  return null;
}

export function detectRisks(b: Business, policies: BusinessPolicy[], s: FinancialSummary = summarize(b), now = new Date()): Risk[] {
  const risks: Risk[] = [];
  const date = now.toISOString().slice(0, 10);
  const h = b.history ?? [];
  const T = RISK_THRESHOLDS;

  // Expenses growing faster than revenue
  const revTrend = trendPct(h.map((m) => m.revenue));
  const expTrend = trendPct(h.map((m) => m.variableCosts + m.fixedCosts + m.debtRepayment));
  if (revTrend !== null && expTrend !== null) {
    const gap = roundTo(expTrend - revTrend, 1);
    const sev = tier(gap, T.expenseGrowthGapPct);
    if (sev) {
      risks.push({
        id: "expense_growth",
        title: "Expenses are growing faster than revenue",
        severity: sev,
        evidence: [`Expenses ${formatPct(expTrend)} vs revenue ${formatPct(revTrend)} (last 3 months vs previous 3)`, `Gap: ${gap} percentage points`],
        consequence: "If this continues, the operating surplus shrinks every month even while sales grow.",
        action: "Identify the expense lines that grew the most and freeze non-essential increases.",
        detectedAt: date,
      });
    }
  }

  // Persistent negative cash flow
  if (s.netProfit < 0) {
    const negMonths = h.slice(-3).filter((m) => m.revenue - m.variableCosts - m.fixedCosts - m.debtRepayment < 0).length;
    risks.push({
      id: "negative_cash_flow",
      title: "Negative operating cash flow",
      severity: s.runway.kind === "runway" && s.runway.months < 3 ? "critical" : "high",
      evidence: [`Monthly shortfall: ${Math.abs(s.netProfit).toLocaleString("en-US")}`, `${negMonths} of the last 3 months were negative`, s.runway.explanation],
      consequence: "Cash will keep falling until the business cannot meet its obligations.",
      action: "Open Recovery Mode to cut costs and speed up collections.",
      detectedAt: date,
    });
  }

  // Low cash reserves
  if (s.reserveMonths !== null) {
    const sev = tier(s.reserveMonths, T.reserveMonths, false);
    if (sev) {
      risks.push({
        id: "low_reserves",
        title: "Low cash reserves",
        severity: sev,
        evidence: [`Cash covers ${s.reserveMonths} months of essential expenses`, `Essential expenses: ${s.essentialMonthly.toLocaleString("en-US")} / month`],
        consequence: "A single slow month or unexpected cost could force emergency borrowing.",
        action: "Pause large discretionary spending and build reserves toward 3 months.",
        detectedAt: date,
      });
    }
  }

  // Declining gross margins
  if (h.length >= 6) {
    const margin = (m: (typeof h)[number]) => (m.revenue > 0 ? ((m.revenue - m.variableCosts) / m.revenue) * 100 : 0);
    const avg = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
    const decline = roundTo(avg(h.slice(-6, -3).map(margin)) - avg(h.slice(-3).map(margin)), 1);
    const sev = tier(decline, T.marginDeclinePts);
    if (sev) {
      risks.push({
        id: "margin_decline",
        title: "Gross margin is declining",
        severity: sev,
        evidence: [`Gross margin fell ${decline} points over the last 3 months`],
        consequence: "Each sale contributes less toward fixed costs, raising your break-even point.",
        action: "Check supplier price increases and reprice low-margin products.",
        detectedAt: date,
      });
    }
  }

  // Debt repayments
  if (s.debtServiceRatioPct !== null) {
    const sev = tier(s.debtServiceRatioPct, T.debtServicePct);
    if (sev) {
      risks.push({
        id: "debt_pressure",
        title: "High debt repayment pressure",
        severity: sev,
        evidence: [`Repayments are ${formatPct(s.debtServiceRatioPct)} of monthly revenue`, `Outstanding debt: ${b.outstandingDebt.toLocaleString("en-US")}`],
        consequence: "Repayments stay fixed when sales fall, squeezing cash in weak months.",
        action: "Avoid new borrowing and consider refinancing to a longer term.",
        detectedAt: date,
      });
    }
  }

  // Excessive inventory
  if (s.inventoryMonths !== null) {
    const sev = tier(s.inventoryMonths, T.inventoryMonths);
    if (sev) {
      risks.push({
        id: "excess_inventory",
        title: "Cash tied up in inventory",
        severity: sev,
        evidence: [`${s.inventoryMonths} months of stock on hand`, `Inventory value: ${b.inventoryValue.toLocaleString("en-US")}`],
        consequence: "Cash locked in slow-moving stock is not available for bills or opportunities.",
        action: "Run a clearance on slow movers and reduce reorder quantities.",
        detectedAt: date,
      });
    }
  }

  // Falling sales
  if (revTrend !== null && revTrend < 0) {
    const sev = tier(-revTrend, T.salesDeclinePct);
    if (sev) {
      risks.push({
        id: "falling_sales",
        title: "Sales are falling",
        severity: sev,
        evidence: [`Revenue trend: ${formatPct(revTrend)} (last 3 months vs previous 3)`],
        consequence: "Falling sales with fixed costs unchanged erodes profit quickly.",
        action: "Review which products and channels declined and focus on retaining key customers.",
        detectedAt: date,
      });
    }
  }

  // Current-state policy violations
  for (const c of evaluatePolicies(policies, {
    cash: s.cash,
    essentialMonthly: s.essentialMonthly,
    revenue: s.revenue,
    variableCosts: s.variableCosts,
    debtRepayment: s.debtRepayment,
    largestOutlay: 0,
    context: "today",
  })) {
    if (!c.violation) continue;
    risks.push({
      id: `policy_${c.policy.id}`,
      title: `Policy breached: ${c.policy.description}`,
      severity: c.violation.severity,
      evidence: [c.violation.message],
      consequence: c.violation.whyItMatters,
      action: c.violation.alternative,
      detectedAt: date,
    });
  }

  return risks.sort((a, b2) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b2.severity]);
}
