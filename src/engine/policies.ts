import type { BusinessPolicy, Severity } from "./types";
import { roundMoney, roundTo } from "./money";

/** A point-in-time financial state that policies are evaluated against. */
export interface PolicyState {
  /** Cash being tested, e.g. the lowest projected cash balance */
  cash: number;
  essentialMonthly: number;
  revenue: number;
  variableCosts: number;
  debtRepayment: number;
  /** Largest single outlay in the proposal (0 for the current state) */
  largestOutlay: number;
  /** Short label describing when this state occurs, e.g. "lowest point, month 1" */
  context: string;
}

export interface PolicyViolation {
  policyId: string;
  policyType: BusinessPolicy["type"];
  policy: string;
  severity: Severity;
  /** How far past the limit, in the policy's own unit */
  amount: number;
  unit: "currency" | "percent";
  required: number;
  actual: number;
  message: string;
  whyItMatters: string;
  alternative: string;
}

export interface PolicyCheck {
  policy: BusinessPolicy;
  passed: boolean;
  required: number;
  actual: number;
  detail: string;
  violation?: PolicyViolation;
}

export const DEFAULT_POLICIES: BusinessPolicy[] = [
  { id: "reserve", type: "minimum_cash_reserve", threshold: 3, enabled: true, description: "Keep at least 3 months of essential expenses in reserve" },
  { id: "debt", type: "maximum_debt_service", threshold: 15, enabled: true, description: "Debt repayments must not exceed 15% of monthly revenue" },
  { id: "margin", type: "minimum_margin", threshold: 35, enabled: true, description: "Maintain a gross profit margin of at least 35%" },
  { id: "spend", type: "spending_limit", threshold: 1_500_000, enabled: true, description: "Review any single outlay above ₦1,500,000" },
];

export const POLICY_LABELS: Record<BusinessPolicy["type"], { name: string; unit: string; hint: string }> = {
  minimum_cash_reserve: { name: "Minimum cash reserve", unit: "months", hint: "Months of essential expenses (fixed costs + debt repayments) to keep in cash" },
  maximum_debt_service: { name: "Maximum debt service", unit: "% of revenue", hint: "Highest share of monthly revenue that may go to debt repayments" },
  minimum_margin: { name: "Minimum gross margin", unit: "%", hint: "Lowest acceptable gross profit margin" },
  spending_limit: { name: "Spending review threshold", unit: "currency", hint: "Any single outlay above this needs a deliberate review" },
};

function severityByRatio(shortfallRatio: number): Severity {
  if (shortfallRatio >= 0.5) return "critical";
  if (shortfallRatio >= 0.25) return "high";
  if (shortfallRatio >= 0.1) return "medium";
  return "low";
}

export function checkPolicy(p: BusinessPolicy, s: PolicyState): PolicyCheck {
  switch (p.type) {
    case "minimum_cash_reserve": {
      const required = roundMoney(p.threshold * s.essentialMonthly);
      const actual = roundMoney(s.cash);
      const shortfall = roundMoney(required - actual);
      const months = s.essentialMonthly > 0 ? roundTo(actual / s.essentialMonthly, 1) : null;
      const detail = `Requires ${required.toLocaleString("en-US")} (${p.threshold} × ${s.essentialMonthly.toLocaleString("en-US")} essential expenses). Cash at ${s.context}: ${actual.toLocaleString("en-US")}${months !== null ? ` (${months} months)` : ""}.`;
      if (shortfall <= 0) return { policy: p, passed: true, required, actual, detail };
      return {
        policy: p,
        passed: false,
        required,
        actual,
        detail,
        violation: {
          policyId: p.id,
          policyType: p.type,
          policy: p.description,
          severity: actual < 0 ? "critical" : severityByRatio(shortfall / Math.max(required, 1)),
          amount: shortfall,
          unit: "currency",
          required,
          actual,
          message: `Cash would fall ${shortfall.toLocaleString("en-US")} below the required reserve of ${required.toLocaleString("en-US")} (${s.context}).`,
          whyItMatters: `With only ${months ?? 0} months of essential expenses in cash, one slow month, a late customer payment or an unexpected repair could leave the business unable to pay rent, salaries or loan repayments on time.`,
          alternative: `Reduce or phase the outlay by about ${shortfall.toLocaleString("en-US")}, delay it until reserves have grown, or secure financing that keeps the reserve intact.`,
        },
      };
    }
    case "maximum_debt_service": {
      const actual = s.revenue > 0 ? roundTo((s.debtRepayment / s.revenue) * 100, 2) : s.debtRepayment > 0 ? 100 : 0;
      const excess = roundTo(actual - p.threshold, 2);
      const detail = `Debt repayments ${s.debtRepayment.toLocaleString("en-US")} are ${actual}% of revenue ${s.revenue.toLocaleString("en-US")} (limit ${p.threshold}%).`;
      if (excess <= 0) return { policy: p, passed: true, required: p.threshold, actual, detail };
      const maxRepayment = roundMoney((p.threshold / 100) * s.revenue);
      return {
        policy: p,
        passed: false,
        required: p.threshold,
        actual,
        detail,
        violation: {
          policyId: p.id,
          policyType: p.type,
          policy: p.description,
          severity: severityByRatio(excess / Math.max(p.threshold, 1)),
          amount: excess,
          unit: "percent",
          required: p.threshold,
          actual,
          message: `Debt repayments would take ${actual}% of revenue, ${excess} points above the ${p.threshold}% limit.`,
          whyItMatters: "High repayments leave less room to absorb a drop in sales. If revenue falls, repayments stay the same and can quickly drain cash.",
          alternative: `Keep total monthly repayments at or below ${maxRepayment.toLocaleString("en-US")}: borrow less, extend the term, or repay existing debt first.`,
        },
      };
    }
    case "minimum_margin": {
      const actual = s.revenue > 0 ? roundTo(((s.revenue - s.variableCosts) / s.revenue) * 100, 2) : 0;
      const gap = roundTo(p.threshold - actual, 2);
      const detail = `Gross margin ${actual}% (minimum ${p.threshold}%).`;
      if (gap <= 0) return { policy: p, passed: true, required: p.threshold, actual, detail };
      return {
        policy: p,
        passed: false,
        required: p.threshold,
        actual,
        detail,
        violation: {
          policyId: p.id,
          policyType: p.type,
          policy: p.description,
          severity: severityByRatio(gap / Math.max(p.threshold, 1)),
          amount: gap,
          unit: "percent",
          required: p.threshold,
          actual,
          message: `Gross margin would be ${actual}%, ${gap} points below the ${p.threshold}% minimum.`,
          whyItMatters: "A thin margin means each sale contributes little toward rent, salaries and debt, so the business needs much more volume just to break even.",
          alternative: "Review supplier costs, adjust prices on low-margin items, or shift the sales mix toward higher-margin products.",
        },
      };
    }
    case "spending_limit": {
      const actual = roundMoney(s.largestOutlay);
      const excess = roundMoney(actual - p.threshold);
      const detail = `Largest single outlay ${actual.toLocaleString("en-US")} (review threshold ${p.threshold.toLocaleString("en-US")}).`;
      if (excess <= 0) return { policy: p, passed: true, required: p.threshold, actual, detail };
      return {
        policy: p,
        passed: false,
        required: p.threshold,
        actual,
        detail,
        violation: {
          policyId: p.id,
          policyType: p.type,
          policy: p.description,
          severity: "medium",
          amount: excess,
          unit: "currency",
          required: p.threshold,
          actual,
          message: `This outlay of ${actual.toLocaleString("en-US")} exceeds the review threshold by ${excess.toLocaleString("en-US")}.`,
          whyItMatters: "Large commitments are hard to reverse. A deliberate review helps confirm the assumptions before the money leaves the business.",
          alternative: "Get a second quote, split the purchase into stages, or confirm the decision with your partner or accountant.",
        },
      };
    }
  }
}

/** Evaluate enabled policies. PolicyGuard warns, it never blocks. */
export function evaluatePolicies(policies: BusinessPolicy[], s: PolicyState): PolicyCheck[] {
  return policies.filter((p) => p.enabled).map((p) => checkPolicy(p, s));
}
