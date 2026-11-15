// Core domain types for the VentureGuard engine.
// All monetary values are in the business's own currency, in major units
// (e.g. naira, not kobo), rounded to 2 decimals by the engine.

export type BusinessGoal =
  | "increase_profitability"
  | "expand_operations"
  | "reduce_expenses"
  | "improve_cash_flow"
  | "reduce_debt"
  | "increase_sales";

export interface MonthlySnapshot {
  /** ISO month, e.g. "2026-06" */
  month: string;
  revenue: number;
  /** Variable costs / cost of goods sold */
  variableCosts: number;
  fixedCosts: number;
  debtRepayment: number;
  /** Cash balance at the end of the month */
  closingCash: number;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  industry: string;
  businessType: string;
  country: string;
  currency: string;
  employees: number;
  branches: number;
  businessAgeYears: number;
  monthlyRevenue: number;
  /** Variable costs, treated as cost of goods sold for margin calculations */
  monthlyVariableCosts: number;
  monthlyFixedCosts: number;
  cashBalance: number;
  outstandingDebt: number;
  monthlyDebtRepayment: number;
  inventoryValue: number;
  monthlySalesTarget: number;
  goals: BusinessGoal[];
  history: MonthlySnapshot[];
  createdAt: string;
  updatedAt: string;
}

export type PolicyType =
  | "minimum_cash_reserve"
  | "maximum_debt_service"
  | "minimum_margin"
  | "spending_limit";

export interface BusinessPolicy {
  id: string;
  type: PolicyType;
  /**
   * minimum_cash_reserve: months of essential expenses
   * maximum_debt_service: max % of monthly revenue spent on debt repayments
   * minimum_margin: min gross margin %
   * spending_limit: max single outlay before review (currency)
   */
  threshold: number;
  enabled: boolean;
  description: string;
}

export interface Explained<T = number> {
  value: T;
  formula: string;
  explanation: string;
}

export type Severity = "critical" | "high" | "medium" | "low";
