"use client";

import type { Business, BusinessGoal } from "@/engine/types";
import { cx, Field, inputClass, NumberInput } from "./ui";

export const GOALS: { key: BusinessGoal; label: string }[] = [
  { key: "increase_profitability", label: "Increase profitability" },
  { key: "expand_operations", label: "Expand operations" },
  { key: "reduce_expenses", label: "Reduce expenses" },
  { key: "improve_cash_flow", label: "Improve cash flow" },
  { key: "reduce_debt", label: "Reduce debt" },
  { key: "increase_sales", label: "Increase sales" },
];

/** Timestamps are filled in when the business is saved. */
export function emptyBusiness(ownerId: string): Business {
  const now = "";
  return {
    id: ownerId,
    ownerId,
    name: "",
    industry: "Retail",
    businessType: "",
    country: "Nigeria",
    currency: "NGN",
    employees: 1,
    branches: 1,
    businessAgeYears: 1,
    monthlyRevenue: 0,
    monthlyVariableCosts: 0,
    monthlyFixedCosts: 0,
    cashBalance: 0,
    outstandingDebt: 0,
    monthlyDebtRepayment: 0,
    inventoryValue: 0,
    monthlySalesTarget: 0,
    goals: [],
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

type Setter = (b: Business) => void;

export function ProfileSection({ b, set }: { b: Business; set: Setter }) {
  const text = (k: keyof Business) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set({ ...b, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Business name">
        <input className={inputClass} value={b.name} onChange={text("name")} placeholder="e.g. Nova Retail" />
      </Field>
      <Field label="Industry">
        <select className={inputClass} value={b.industry} onChange={text("industry")}>
          {["Retail", "Restaurant & food", "Fashion", "Supermarket", "Distribution", "Services", "Online business", "Technology", "Manufacturing", "Other"].map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </Field>
      <Field label="Business type">
        <input className={inputClass} value={b.businessType} onChange={text("businessType")} placeholder="e.g. Household goods store" />
      </Field>
      <Field label="Country">
        <input className={inputClass} value={b.country} onChange={text("country")} />
      </Field>
      <Field label="Currency" help="All calculations use this one currency">
        <select className={inputClass} value={b.currency} onChange={text("currency")}>
          {["NGN", "USD", "GBP", "EUR", "KES", "GHS", "ZAR", "INR"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Business age (years)">
        <NumberInput value={b.businessAgeYears} onChange={(n) => set({ ...b, businessAgeYears: n })} />
      </Field>
      <Field label="Employees">
        <NumberInput value={b.employees} onChange={(n) => set({ ...b, employees: Math.round(n) })} />
      </Field>
      <Field label="Branches">
        <NumberInput value={b.branches} onChange={(n) => set({ ...b, branches: Math.round(n) })} />
      </Field>
    </div>
  );
}

export function FinancialSection({ b, set }: { b: Business; set: Setter }) {
  const money = (k: keyof Business, label: string, help?: string) => (
    <Field label={label} help={help}>
      <NumberInput value={b[k] as number} prefix={b.currency === "NGN" ? "₦" : undefined} step={10_000} onChange={(n) => set({ ...b, [k]: n })} />
    </Field>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {money("monthlyRevenue", "Monthly revenue", "Average sales per month")}
      {money("monthlySalesTarget", "Monthly sales target")}
      {money("monthlyVariableCosts", "Monthly variable costs", "Costs that rise with sales: stock, packaging, delivery (used as cost of goods sold)")}
      {money("monthlyFixedCosts", "Monthly fixed costs", "Rent, salaries, utilities: paid whatever your sales")}
      {money("cashBalance", "Current cash balance", "Bank + cash on hand")}
      {money("inventoryValue", "Inventory value", "Stock at cost")}
      {money("outstandingDebt", "Outstanding debts")}
      {money("monthlyDebtRepayment", "Monthly debt repayments")}
    </div>
  );
}

export function GoalsSection({ b, set }: { b: Business; set: Setter }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {GOALS.map((g) => {
        const on = b.goals.includes(g.key);
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => set({ ...b, goals: on ? b.goals.filter((x) => x !== g.key) : [...b.goals, g.key] })}
            className={cx("rounded-xl border p-3 text-left text-[14px] font-medium transition", on ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white hover:border-navy-600")}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

export function validateBusiness(b: Business): string | null {
  if (!b.name.trim()) return "Please enter your business name.";
  const nums: (keyof Business)[] = ["monthlyRevenue", "monthlyVariableCosts", "monthlyFixedCosts", "cashBalance", "outstandingDebt", "monthlyDebtRepayment", "inventoryValue", "monthlySalesTarget"];
  for (const k of nums) {
    const v = b[k] as number;
    if (!Number.isFinite(v) || v < 0) return "Amounts must be zero or positive numbers.";
  }
  if (b.monthlyRevenue <= 0) return "Enter your monthly revenue. VentureGuard needs it to calculate margins.";
  return null;
}
