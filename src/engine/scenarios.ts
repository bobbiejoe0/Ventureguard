import type { Business, BusinessPolicy } from "./types";
import { cashRunway, essentialMonthlyExpenses, simplePayback, type RunwayResult } from "./calculations";
import { toImpact, type DecisionImpact, type DecisionType } from "./decisions";
import { evaluatePolicies, type PolicyCheck } from "./policies";
import { roundMoney, roundTo } from "./money";

export type ScenarioKey = "optimistic" | "expected" | "pessimistic";

export interface SimulationAssumptions {
  horizonMonths: number;
  /** Months to wait before committing (0 = now) */
  startDelayMonths: number;
  /** Multiplier on the decision's revenue in the optimistic case */
  optimisticFactor: number;
  /** Multiplier on the decision's revenue in the pessimistic case */
  pessimisticFactor: number;
  /** Share of full revenue reached in months 1, 2, 3… after launch; 1 afterwards */
  rampUp: number[];
}

/** Defaults are always surfaced to the user as labelled assumptions. */
export const DEFAULT_ASSUMPTIONS: SimulationAssumptions = {
  horizonMonths: 12,
  startDelayMonths: 0,
  optimisticFactor: 1.2,
  pessimisticFactor: 0.6,
  rampUp: [0.5, 0.7, 0.85],
};

export interface ProjectionMonth {
  month: number;
  cash: number;
  /** Cash if the decision is not taken */
  baselineCash: number;
  decisionNet: number;
  totalNet: number;
}

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  revenueFactor: number;
  months: ProjectionMonth[];
  upfrontCost: number;
  cashAfterInvestment: number;
  /** Decision's own monthly profit once fully ramped */
  decisionMonthlyProfit: number;
  /** Whole business monthly profit once fully ramped */
  businessMonthlyProfit: number;
  minCash: number;
  minCashMonth: number;
  firstNegativeCashMonth: number | null;
  endingCash: number;
  baselineEndingCash: number;
  /** Extra monthly revenue the decision needs to cover its own costs (0 if already covered) */
  additionalRevenueToBreakEven: number | null;
  breaksEven: boolean;
  /** Month the cumulative decision cash flow turns positive (within horizon) */
  paybackMonth: number | null;
  simplePaybackMonths: number | null;
  runway: RunwayResult;
  policyChecks: PolicyCheck[];
  risks: string[];
}

export interface SimulationResult {
  decisionType: DecisionType;
  inputs: Record<string, number>;
  assumptions: SimulationAssumptions;
  impact: DecisionImpact;
  scenarios: Record<ScenarioKey, ScenarioResult>;
}

function runScenario(
  key: ScenarioKey,
  factor: number,
  b: Business,
  impact: DecisionImpact,
  a: SimulationAssumptions,
  policies: BusinessPolicy[],
): ScenarioResult {
  const baseNet = roundMoney(b.monthlyRevenue - b.monthlyVariableCosts - b.monthlyFixedCosts - b.monthlyDebtRepayment);
  const delay = Math.max(0, Math.round(a.startDelayMonths));
  const H = Math.max(1, Math.round(a.horizonMonths));
  let cash = b.cashBalance;
  let baselineCash = b.cashBalance;
  let cumulative = 0;
  let paybackMonth: number | null = null;
  let cashAfterInvestment = b.cashBalance;
  let minCash = b.cashBalance;
  let minCashMonth = 0;
  let firstNegative: number | null = null;
  const months: ProjectionMonth[] = [];

  const decisionNetFor = (k: number) => {
    const ramp = impact.rampUp ? (a.rampUp[k - 1] ?? 1) : 1;
    const active = impact.revenueMonths === 0 || k <= impact.revenueMonths;
    const rev = active ? impact.monthlyRevenue * factor * ramp : 0;
    const vc = active ? impact.monthlyVariableCost * factor * ramp : 0;
    const debt = impact.debtTermMonths === 0 || k <= impact.debtTermMonths ? impact.monthlyDebtRepayment : 0;
    return roundMoney(rev - vc - impact.monthlyFixedCost - debt);
  };

  for (let m = 1; m <= H; m++) {
    const k = m - delay; // months since the decision started
    let decisionNet = 0;
    if (k === 1) {
      const startCash = roundMoney(cash + impact.upfrontInflow - impact.upfrontCost);
      cash = startCash;
      cashAfterInvestment = startCash;
      cumulative = impact.upfrontInflow - impact.upfrontCost;
      if (startCash < minCash) {
        minCash = startCash;
        minCashMonth = m;
      }
    }
    if (k >= 1) {
      decisionNet = decisionNetFor(k);
      const before = cumulative;
      cumulative += decisionNet;
      if (paybackMonth === null && before < 0 && cumulative >= 0) paybackMonth = m;
    }
    cash = roundMoney(cash + baseNet + decisionNet);
    baselineCash = roundMoney(baselineCash + baseNet);
    if (cash < minCash) {
      minCash = cash;
      minCashMonth = m;
    }
    if (cash < 0 && firstNegative === null) firstNegative = m;
    months.push({ month: m, cash, baselineCash, decisionNet, totalNet: roundMoney(baseNet + decisionNet) });
  }
  if (delay >= H) cashAfterInvestment = roundMoney(cash + impact.upfrontInflow - impact.upfrontCost);

  // Steady state (fully ramped, still repaying debt if any)
  const fullRev = impact.monthlyRevenue * factor;
  const fullVar = impact.monthlyVariableCost * factor;
  const decisionMonthlyProfit = roundMoney(fullRev - fullVar - impact.monthlyFixedCost - impact.monthlyDebtRepayment);
  const businessMonthlyProfit = roundMoney(baseNet + decisionMonthlyProfit);

  // Break-even for the decision itself
  const decFixed = impact.monthlyFixedCost + impact.monthlyDebtRepayment;
  let additionalRevenueToBreakEven: number | null = 0;
  if (decisionMonthlyProfit < 0) {
    const cmr = impact.monthlyRevenue > 0 ? (impact.monthlyRevenue - impact.monthlyVariableCost) / impact.monthlyRevenue : null;
    additionalRevenueToBreakEven = cmr && cmr > 0 ? roundMoney(decFixed / cmr - fullRev) : null;
  }

  const netInvestment = impact.upfrontCost - impact.upfrontInflow;
  const essentialAfter = roundMoney(essentialMonthlyExpenses(b) + impact.monthlyEssentialCost);
  const policyChecks = evaluatePolicies(policies, {
    cash: minCash,
    essentialMonthly: essentialAfter,
    revenue: roundMoney(b.monthlyRevenue + fullRev),
    variableCosts: roundMoney(b.monthlyVariableCosts + fullVar),
    debtRepayment: roundMoney(b.monthlyDebtRepayment + impact.monthlyDebtRepayment),
    largestOutlay: impact.upfrontCost,
    context: minCashMonth === 0 ? "today" : `its lowest point (month ${minCashMonth})`,
  });

  const risks: string[] = [];
  if (firstNegative !== null) risks.push(`Cash runs out in month ${firstNegative}. The business could not pay its bills without new funding.`);
  if (decisionMonthlyProfit < 0) risks.push(`The decision loses ${Math.abs(decisionMonthlyProfit).toLocaleString("en-US")} per month even at full operation, so the existing business has to subsidise it.`);
  if (businessMonthlyProfit < 0) risks.push("The whole business becomes loss-making.");
  if (netInvestment > 0 && paybackMonth === null) risks.push(`The investment is not recovered within the ${H}-month horizon.`);
  if (b.cashBalance > 0 && cashAfterInvestment < b.cashBalance * 0.4) risks.push(`The investment uses ${roundTo(((b.cashBalance - cashAfterInvestment) / b.cashBalance) * 100, 0)}% of available cash.`);

  const labels: Record<ScenarioKey, string> = { optimistic: "Optimistic", expected: "Expected", pessimistic: "Pessimistic" };
  return {
    key,
    label: labels[key],
    revenueFactor: factor,
    months,
    upfrontCost: impact.upfrontCost,
    cashAfterInvestment,
    decisionMonthlyProfit,
    businessMonthlyProfit,
    minCash,
    minCashMonth,
    firstNegativeCashMonth: firstNegative,
    endingCash: cash,
    baselineEndingCash: baselineCash,
    additionalRevenueToBreakEven,
    breaksEven: decisionMonthlyProfit >= 0,
    paybackMonth,
    simplePaybackMonths: netInvestment > 0 ? simplePayback(netInvestment, decisionMonthlyProfit) : null,
    runway: cashRunway(cashAfterInvestment, businessMonthlyProfit),
    policyChecks,
    risks,
  };
}

export function simulateDecision(
  b: Business,
  type: DecisionType,
  inputs: Record<string, number>,
  policies: BusinessPolicy[],
  assumptions: Partial<SimulationAssumptions> = {},
): SimulationResult {
  const a = { ...DEFAULT_ASSUMPTIONS, ...assumptions };
  const impact = toImpact(type, inputs, b);
  return {
    decisionType: type,
    inputs,
    assumptions: a,
    impact,
    scenarios: {
      optimistic: runScenario("optimistic", a.optimisticFactor, b, impact, a, policies),
      expected: runScenario("expected", 1, b, impact, a, policies),
      pessimistic: runScenario("pessimistic", a.pessimisticFactor, b, impact, a, policies),
    },
  };
}
