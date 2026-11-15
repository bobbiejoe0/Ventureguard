import type { Business, Explained } from "./types";
import { requireFinite, requireNonNegative, roundMoney, roundTo, safeDivide } from "./money";

export function grossProfit(revenue: number, cogs: number): Explained {
  const r = requireFinite(revenue, "revenue");
  const c = requireNonNegative(cogs, "cost of goods sold");
  const value = roundMoney(r - c);
  return {
    value,
    formula: "Revenue − Cost of Goods Sold",
    explanation: `Revenue of ${r} minus cost of goods sold of ${c} leaves ${value} gross profit.`,
  };
}

/** Returns null when revenue is zero: a margin is undefined, not 0%. */
export function grossMarginPct(revenue: number, cogs: number): Explained<number | null> {
  const r = requireFinite(revenue, "revenue");
  if (r <= 0) {
    return {
      value: null,
      formula: "(Gross Profit ÷ Revenue) × 100",
      explanation: "No revenue recorded, so gross margin cannot be calculated.",
    };
  }
  const value = roundTo((grossProfit(r, cogs).value / r) * 100, 2);
  return {
    value,
    formula: "(Gross Profit ÷ Revenue) × 100",
    explanation: `For every 100 of sales, ${roundTo(value, 1)} is left after product costs.`,
  };
}

export function totalOperatingExpenses(b: Pick<Business, "monthlyVariableCosts" | "monthlyFixedCosts" | "monthlyDebtRepayment">): number {
  return roundMoney(
    requireNonNegative(b.monthlyVariableCosts, "variable costs") +
      requireNonNegative(b.monthlyFixedCosts, "fixed costs") +
      requireNonNegative(b.monthlyDebtRepayment, "debt repayment"),
  );
}

/**
 * Net operating profit. Debt repayments are included as a monthly obligation
 * because small business owners experience them as a monthly cost.
 */
export function netOperatingProfit(revenue: number, totalExpenses: number): Explained {
  const r = requireFinite(revenue, "revenue");
  const e = requireNonNegative(totalExpenses, "total expenses");
  const value = roundMoney(r - e);
  return {
    value,
    formula: "Revenue − Total Operating Expenses",
    explanation:
      value >= 0
        ? `The business keeps ${value} each month after all expenses.`
        : `The business spends ${-value} more than it earns each month.`,
  };
}

export function netMarginPct(revenue: number, netProfit: number): number | null {
  if (revenue <= 0) return null;
  return roundTo((netProfit / revenue) * 100, 2);
}

export function netCashFlow(inflows: number, outflows: number): number {
  return roundMoney(requireFinite(inflows, "inflows") - requireNonNegative(outflows, "outflows"));
}

export type RunwayResult =
  | { kind: "positive_cash_flow"; monthlySurplus: number; explanation: string }
  | { kind: "runway"; months: number; monthlyBurn: number; explanation: string }
  | { kind: "no_cash"; monthlyBurn: number; explanation: string };

/** Cash runway = available cash ÷ monthly net burn. Never fabricates a runway for profitable businesses. */
export function cashRunway(availableCash: number, monthlyNetCashFlow: number): RunwayResult {
  const cash = requireFinite(availableCash, "available cash");
  const flow = requireFinite(monthlyNetCashFlow, "monthly net cash flow");
  if (flow >= 0) {
    return {
      kind: "positive_cash_flow",
      monthlySurplus: roundMoney(flow),
      explanation: "The business currently has positive operating cash flow, so cash is growing rather than running down.",
    };
  }
  const burn = -flow;
  if (cash <= 0) {
    return { kind: "no_cash", monthlyBurn: roundMoney(burn), explanation: "No cash is available to cover the monthly shortfall." };
  }
  const months = roundTo(cash / burn, 1);
  return {
    kind: "runway",
    months,
    monthlyBurn: roundMoney(burn),
    explanation: `At the current burn of ${roundMoney(burn)} per month, cash lasts about ${months} months.`,
  };
}

export interface BreakEvenResult {
  contributionMarginRatio: number | null;
  breakEvenRevenue: number | null;
  /** Revenue still needed (0 when already above break-even) */
  revenueGap: number | null;
  explanation: string;
}

/** Break-even revenue = fixed costs ÷ contribution margin ratio. */
export function breakEven(revenue: number, variableCosts: number, fixedCosts: number): BreakEvenResult {
  const r = requireFinite(revenue, "revenue");
  const v = requireNonNegative(variableCosts, "variable costs");
  const f = requireNonNegative(fixedCosts, "fixed costs");
  if (r <= 0) {
    return {
      contributionMarginRatio: null,
      breakEvenRevenue: null,
      revenueGap: null,
      explanation: "Break-even needs revenue data to estimate the contribution margin.",
    };
  }
  const cmr = (r - v) / r;
  if (cmr <= 0) {
    return {
      contributionMarginRatio: roundTo(cmr, 4),
      breakEvenRevenue: null,
      revenueGap: null,
      explanation: "Variable costs are equal to or higher than revenue, so more sales cannot cover fixed costs. Pricing or product costs must change first.",
    };
  }
  const be = roundMoney(f / cmr);
  return {
    contributionMarginRatio: roundTo(cmr, 4),
    breakEvenRevenue: be,
    revenueGap: roundMoney(Math.max(0, be - r)),
    explanation: `Each 100 of sales contributes ${roundTo(cmr * 100, 1)} toward fixed costs, so ${be} in monthly sales is needed to cover ${f} of fixed costs.`,
  };
}

export interface LoanResult {
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
  schedule: { month: number; payment: number; interest: number; principal: number; balance: number }[];
}

/** Standard amortizing loan: P × r / (1 − (1 + r)^−n), r = monthly rate. */
export function loanRepayment(principal: number, annualRatePct: number, termMonths: number): LoanResult {
  const p = requireNonNegative(principal, "loan principal");
  const rate = requireNonNegative(annualRatePct, "interest rate");
  const n = Math.round(requireNonNegative(termMonths, "loan term"));
  if (n <= 0) throw new Error("loan term must be at least 1 month");
  if (p === 0) return { monthlyPayment: 0, totalRepayment: 0, totalInterest: 0, schedule: [] };
  const r = rate / 100 / 12;
  const rawPayment = r === 0 ? p / n : (p * r) / (1 - (1 + r) ** -n);
  const schedule: LoanResult["schedule"] = [];
  let balance = p;
  let total = 0;
  for (let m = 1; m <= n; m++) {
    const interest = roundMoney(balance * r);
    // Final payment clears any rounding residue.
    const payment = m === n ? roundMoney(balance + interest) : roundMoney(rawPayment);
    const princ = roundMoney(payment - interest);
    balance = roundMoney(balance - princ);
    total += payment;
    schedule.push({ month: m, payment, interest, principal: princ, balance: Math.max(0, balance) });
  }
  const totalRepayment = roundMoney(total);
  return {
    monthlyPayment: roundMoney(rawPayment),
    totalRepayment,
    totalInterest: roundMoney(totalRepayment - p),
    schedule,
  };
}

/** Simple payback. Only meaningful when the added monthly cash flow is positive. */
export function simplePayback(initialInvestment: number, monthlyNetCashFlow: number): number | null {
  const inv = requireNonNegative(initialInvestment, "initial investment");
  const flow = requireFinite(monthlyNetCashFlow, "monthly net cash flow");
  if (flow <= 0) return null;
  if (inv === 0) return 0;
  return roundTo(inv / flow, 1);
}

/** Months of essential expenses covered by cash. Essential = fixed costs + debt repayments. */
export function essentialMonthlyExpenses(b: Pick<Business, "monthlyFixedCosts" | "monthlyDebtRepayment">): number {
  return roundMoney(b.monthlyFixedCosts + b.monthlyDebtRepayment);
}

export function reserveMonths(cash: number, essentialMonthly: number): number | null {
  if (essentialMonthly <= 0) return null;
  return roundTo(safeDivide(cash, essentialMonthly), 1);
}

export interface FinancialSummary {
  revenue: number;
  variableCosts: number;
  fixedCosts: number;
  debtRepayment: number;
  totalExpenses: number;
  grossProfit: number;
  grossMarginPct: number | null;
  netProfit: number;
  netMarginPct: number | null;
  cash: number;
  essentialMonthly: number;
  reserveMonths: number | null;
  runway: RunwayResult;
  breakEven: BreakEvenResult;
  debtServiceRatioPct: number | null;
  inventoryMonths: number | null;
  salesTargetGap: number;
}

export function summarize(b: Business): FinancialSummary {
  const totalExpenses = totalOperatingExpenses(b);
  const net = netOperatingProfit(b.monthlyRevenue, totalExpenses).value;
  const essential = essentialMonthlyExpenses(b);
  return {
    revenue: roundMoney(b.monthlyRevenue),
    variableCosts: roundMoney(b.monthlyVariableCosts),
    fixedCosts: roundMoney(b.monthlyFixedCosts),
    debtRepayment: roundMoney(b.monthlyDebtRepayment),
    totalExpenses,
    grossProfit: grossProfit(b.monthlyRevenue, b.monthlyVariableCosts).value,
    grossMarginPct: grossMarginPct(b.monthlyRevenue, b.monthlyVariableCosts).value,
    netProfit: net,
    netMarginPct: netMarginPct(b.monthlyRevenue, net),
    cash: roundMoney(b.cashBalance),
    essentialMonthly: essential,
    reserveMonths: reserveMonths(b.cashBalance, essential),
    runway: cashRunway(b.cashBalance, net),
    // Debt repayments behave like fixed costs for break-even purposes.
    breakEven: breakEven(b.monthlyRevenue, b.monthlyVariableCosts, b.monthlyFixedCosts + b.monthlyDebtRepayment),
    debtServiceRatioPct: b.monthlyRevenue > 0 ? roundTo((b.monthlyDebtRepayment / b.monthlyRevenue) * 100, 2) : null,
    inventoryMonths: b.monthlyVariableCosts > 0 ? roundTo(b.inventoryValue / b.monthlyVariableCosts, 1) : null,
    salesTargetGap: roundMoney(Math.max(0, b.monthlySalesTarget - b.monthlyRevenue)),
  };
}

/** Percentage change between the average of the last `n` months and the `n` before that. */
export function trendPct(values: number[], n = 3): number | null {
  if (values.length < n * 2) return null;
  const recent = values.slice(-n);
  const prior = values.slice(-n * 2, -n);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const p = avg(prior);
  if (p === 0) return null;
  return roundTo(((avg(recent) - p) / Math.abs(p)) * 100, 2);
}
