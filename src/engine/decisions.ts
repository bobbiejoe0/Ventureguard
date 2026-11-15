import type { Business } from "./types";
import { loanRepayment } from "./calculations";
import { roundMoney, safeDivide } from "./money";

export type DecisionType =
  | "open_branch"
  | "hire_staff"
  | "take_loan"
  | "buy_equipment"
  | "raise_prices"
  | "launch_product"
  | "increase_advertising"
  | "buy_inventory";

export interface FieldSpec {
  key: string;
  label: string;
  kind: "money" | "percent" | "count" | "months";
  help?: string;
  /** Defaults the engine supplies. These are shown to the user as "default assumption". */
  defaultFrom?: (b: Business) => number;
}

export interface DecisionTemplate {
  type: DecisionType;
  title: string;
  description: string;
  fields: FieldSpec[];
}

/** What a decision does to cash, normalised so every decision type can share one projection. */
export interface DecisionImpact {
  upfrontCost: number;
  /** Cash received at start (loan proceeds) */
  upfrontInflow: number;
  monthlyRevenue: number;
  monthlyVariableCost: number;
  monthlyFixedCost: number;
  /** Added to essential expenses for reserve policies */
  monthlyEssentialCost: number;
  monthlyDebtRepayment: number;
  debtTermMonths: number;
  addedDebt: number;
  /** Months the added revenue lasts; 0 = ongoing */
  revenueMonths: number;
  /** Whether new revenue ramps up (new branch / product) */
  rampUp: boolean;
  notes: string[];
}

const varRatio = (b: Business) => Math.round(safeDivide(b.monthlyVariableCosts, b.monthlyRevenue, 0.5) * 1000) / 10;

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    type: "open_branch",
    title: "Open another branch",
    description: "Invest in a new location with its own revenue and running costs.",
    fields: [
      { key: "investment", label: "Initial investment (fit-out, rent deposit, stock)", kind: "money" },
      { key: "monthlyRevenue", label: "Expected monthly revenue at full operation", kind: "money" },
      { key: "variableCostPct", label: "Variable costs (% of branch revenue)", kind: "percent", help: "Defaults to your current business ratio", defaultFrom: varRatio },
      { key: "monthlyFixed", label: "Branch monthly fixed costs (rent, salaries, utilities)", kind: "money" },
    ],
  },
  {
    type: "hire_staff",
    title: "Hire additional employees",
    description: "Add staff and estimate the extra revenue they make possible.",
    fields: [
      { key: "count", label: "Number of new hires", kind: "count" },
      { key: "salary", label: "Monthly cost per hire (salary + benefits)", kind: "money" },
      { key: "onboarding", label: "One-time recruitment & onboarding cost", kind: "money" },
      { key: "revenueGain", label: "Expected extra monthly revenue", kind: "money" },
    ],
  },
  {
    type: "take_loan",
    title: "Take a business loan",
    description: "Borrow money and test whether the repayments are sustainable.",
    fields: [
      { key: "principal", label: "Loan amount", kind: "money" },
      { key: "ratePct", label: "Annual interest rate (%)", kind: "percent" },
      { key: "term", label: "Repayment period (months)", kind: "months" },
      { key: "revenueGain", label: "Expected extra monthly revenue from using the loan", kind: "money" },
      { key: "spend", label: "Amount spent immediately from the loan", kind: "money" },
    ],
  },
  {
    type: "buy_equipment",
    title: "Purchase equipment",
    description: "Buy equipment that saves costs or increases output.",
    fields: [
      { key: "cost", label: "Equipment cost", kind: "money" },
      { key: "savings", label: "Monthly cost savings", kind: "money" },
      { key: "revenueGain", label: "Expected extra monthly revenue", kind: "money" },
      { key: "maintenance", label: "Monthly maintenance & running costs", kind: "money" },
    ],
  },
  {
    type: "raise_prices",
    title: "Increase product prices",
    description: "Raise prices and account for customers you may lose.",
    fields: [
      { key: "increasePct", label: "Price increase (%)", kind: "percent" },
      { key: "volumeLossPct", label: "Expected drop in units sold (%)", kind: "percent" },
    ],
  },
  {
    type: "launch_product",
    title: "Launch a new product",
    description: "Invest in a new product line with its own margin.",
    fields: [
      { key: "launchCost", label: "Launch cost (development, initial stock, marketing)", kind: "money" },
      { key: "monthlyRevenue", label: "Expected monthly revenue at full sales", kind: "money" },
      { key: "variableCostPct", label: "Product cost (% of its revenue)", kind: "percent", defaultFrom: varRatio },
      { key: "monthlyFixed", label: "Added monthly fixed costs", kind: "money" },
    ],
  },
  {
    type: "increase_advertising",
    title: "Increase advertising",
    description: "Spend more on marketing and estimate the sales uplift.",
    fields: [
      { key: "monthlySpend", label: "Additional monthly ad spend", kind: "money" },
      { key: "upliftPct", label: "Expected revenue uplift (%)", kind: "percent" },
    ],
  },
  {
    type: "buy_inventory",
    title: "Purchase additional inventory",
    description: "Buy stock now and sell it over the coming months.",
    fields: [
      { key: "amount", label: "Inventory purchase amount", kind: "money" },
      { key: "markupPct", label: "Expected markup on cost (%)", kind: "percent" },
      { key: "sellMonths", label: "Months to sell through the stock", kind: "months" },
    ],
  },
];

export function getTemplate(type: DecisionType): DecisionTemplate {
  const t = DECISION_TEMPLATES.find((d) => d.type === type);
  if (!t) throw new Error(`Unknown decision type: ${type}`);
  return t;
}

const n = (inputs: Record<string, number>, key: string) => {
  const v = inputs[key];
  return Number.isFinite(v) ? Math.max(0, v) : 0;
};

/** Translate decision-specific inputs into a common cash impact. Pure and deterministic. */
export function toImpact(type: DecisionType, inputs: Record<string, number>, b: Business): DecisionImpact {
  const base: DecisionImpact = {
    upfrontCost: 0,
    upfrontInflow: 0,
    monthlyRevenue: 0,
    monthlyVariableCost: 0,
    monthlyFixedCost: 0,
    monthlyEssentialCost: 0,
    monthlyDebtRepayment: 0,
    debtTermMonths: 0,
    addedDebt: 0,
    revenueMonths: 0,
    rampUp: false,
    notes: [],
  };
  switch (type) {
    case "open_branch": {
      const rev = n(inputs, "monthlyRevenue");
      const fixed = n(inputs, "monthlyFixed");
      return {
        ...base,
        upfrontCost: n(inputs, "investment"),
        monthlyRevenue: rev,
        monthlyVariableCost: roundMoney((rev * n(inputs, "variableCostPct")) / 100),
        monthlyFixedCost: fixed,
        monthlyEssentialCost: fixed,
        rampUp: true,
        notes: ["Branch fixed costs become essential expenses that must also be covered by your reserve."],
      };
    }
    case "hire_staff": {
      const payroll = roundMoney(n(inputs, "count") * n(inputs, "salary"));
      return {
        ...base,
        upfrontCost: n(inputs, "onboarding"),
        monthlyRevenue: n(inputs, "revenueGain"),
        monthlyVariableCost: roundMoney(n(inputs, "revenueGain") * safeDivide(b.monthlyVariableCosts, b.monthlyRevenue, 0)),
        monthlyFixedCost: payroll,
        monthlyEssentialCost: payroll,
        rampUp: true,
        notes: ["New revenue carries your current variable-cost ratio.", "Payroll is treated as an essential expense."],
      };
    }
    case "take_loan": {
      const loan = loanRepayment(n(inputs, "principal"), n(inputs, "ratePct"), Math.max(1, n(inputs, "term")));
      const gain = n(inputs, "revenueGain");
      return {
        ...base,
        upfrontInflow: n(inputs, "principal"),
        upfrontCost: n(inputs, "spend"),
        monthlyRevenue: gain,
        monthlyVariableCost: roundMoney(gain * safeDivide(b.monthlyVariableCosts, b.monthlyRevenue, 0)),
        monthlyDebtRepayment: loan.monthlyPayment,
        monthlyEssentialCost: loan.monthlyPayment,
        debtTermMonths: Math.max(1, Math.round(n(inputs, "term"))),
        addedDebt: n(inputs, "principal"),
        rampUp: gain > 0,
        notes: [
          `Monthly repayment ${loan.monthlyPayment.toLocaleString("en-US")} for ${Math.round(n(inputs, "term"))} months.`,
          `Total repayment ${loan.totalRepayment.toLocaleString("en-US")}, of which ${loan.totalInterest.toLocaleString("en-US")} is interest.`,
        ],
      };
    }
    case "buy_equipment": {
      const gain = n(inputs, "revenueGain");
      return {
        ...base,
        upfrontCost: n(inputs, "cost"),
        monthlyRevenue: gain,
        monthlyVariableCost: roundMoney(gain * safeDivide(b.monthlyVariableCosts, b.monthlyRevenue, 0)),
        // Savings reduce fixed costs; maintenance adds to them.
        monthlyFixedCost: roundMoney(n(inputs, "maintenance") - n(inputs, "savings")),
        rampUp: false,
        notes: ["Cost savings are modelled as a reduction in fixed costs."],
      };
    }
    case "raise_prices": {
      const p = n(inputs, "increasePct") / 100;
      const v = Math.min(1, n(inputs, "volumeLossPct") / 100);
      const newRev = b.monthlyRevenue * (1 + p) * (1 - v);
      const newVar = b.monthlyVariableCosts * (1 - v);
      return {
        ...base,
        monthlyRevenue: roundMoney(newRev - b.monthlyRevenue),
        monthlyVariableCost: roundMoney(newVar - b.monthlyVariableCosts),
        notes: ["Revenue = current revenue × (1 + price increase) × (1 − volume loss). Product costs fall with the units you no longer sell."],
      };
    }
    case "launch_product": {
      const rev = n(inputs, "monthlyRevenue");
      return {
        ...base,
        upfrontCost: n(inputs, "launchCost"),
        monthlyRevenue: rev,
        monthlyVariableCost: roundMoney((rev * n(inputs, "variableCostPct")) / 100),
        monthlyFixedCost: n(inputs, "monthlyFixed"),
        monthlyEssentialCost: n(inputs, "monthlyFixed"),
        rampUp: true,
        notes: [],
      };
    }
    case "increase_advertising": {
      const gain = roundMoney((b.monthlyRevenue * n(inputs, "upliftPct")) / 100);
      return {
        ...base,
        monthlyRevenue: gain,
        monthlyVariableCost: roundMoney(gain * safeDivide(b.monthlyVariableCosts, b.monthlyRevenue, 0)),
        monthlyFixedCost: n(inputs, "monthlySpend"),
        rampUp: true,
        notes: ["Advertising is discretionary, so it is not counted as an essential expense."],
      };
    }
    case "buy_inventory": {
      const amount = n(inputs, "amount");
      const months = Math.max(1, Math.round(n(inputs, "sellMonths")));
      const salesTotal = amount * (1 + n(inputs, "markupPct") / 100);
      return {
        ...base,
        upfrontCost: amount,
        // Stock already paid for upfront, so the monthly sales carry no extra variable cost.
        monthlyRevenue: roundMoney(salesTotal / months),
        revenueMonths: months,
        notes: [`Stock sells evenly over ${months} months; cost is paid upfront so monthly sales add no extra product cost.`],
      };
    }
  }
}
