import { describe, expect, it } from "vitest";
import {
  breakEven,
  cashRunway,
  grossMarginPct,
  grossProfit,
  loanRepayment,
  netOperatingProfit,
  simplePayback,
  summarize,
  trendPct,
} from "@/engine/calculations";
import { roundMoney, safeDivide } from "@/engine/money";
import { computeHealthScore } from "@/engine/healthScore";
import { checkPolicy, DEFAULT_POLICIES } from "@/engine/policies";
import { simulateDecision } from "@/engine/scenarios";
import { detectRisks } from "@/engine/risks";
import { toImpact } from "@/engine/decisions";
import { buildRecoveryPlan } from "@/engine/recovery";
import { NOVA_BRANCH_INPUTS, novaRetail } from "@/engine/demo";

describe("money helpers", () => {
  it("rounds without float drift", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(NaN)).toBe(0);
  });
  it("never divides by zero", () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });
});

describe("core calculations", () => {
  it("gross profit and margin", () => {
    expect(grossProfit(3_500_000, 1_750_000).value).toBe(1_750_000);
    expect(grossMarginPct(3_500_000, 1_750_000).value).toBe(50);
  });
  it("margin is undefined (null) at zero revenue rather than 0%", () => {
    expect(grossMarginPct(0, 100).value).toBeNull();
  });
  it("rejects negative costs", () => {
    expect(() => grossProfit(100, -5)).toThrow();
  });
  it("net operating profit", () => {
    expect(netOperatingProfit(3_500_000, 2_800_000).value).toBe(700_000);
    expect(netOperatingProfit(1_000, 1_500).value).toBe(-500);
  });
  it("runway: positive cash flow does not produce an artificial runway", () => {
    expect(cashRunway(1_000_000, 50_000).kind).toBe("positive_cash_flow");
  });
  it("runway: months of cash at current burn", () => {
    const r = cashRunway(1_200_000, -300_000);
    expect(r.kind).toBe("runway");
    if (r.kind === "runway") expect(r.months).toBe(4);
  });
  it("runway: no cash", () => {
    expect(cashRunway(0, -100).kind).toBe("no_cash");
  });
  it("break-even revenue = fixed / contribution margin ratio", () => {
    const be = breakEven(3_500_000, 1_750_000, 1_050_000);
    expect(be.contributionMarginRatio).toBe(0.5);
    expect(be.breakEvenRevenue).toBe(2_100_000);
    expect(be.revenueGap).toBe(0);
  });
  it("break-even handles zero revenue and negative contribution", () => {
    expect(breakEven(0, 0, 100).breakEvenRevenue).toBeNull();
    expect(breakEven(100, 120, 50).breakEvenRevenue).toBeNull();
  });
  it("loan amortization matches the standard formula", () => {
    // 1,000,000 at 12%/yr for 12 months -> 88,848.79/month
    const l = loanRepayment(1_000_000, 12, 12);
    expect(l.monthlyPayment).toBeCloseTo(88_848.79, 2);
    expect(l.schedule).toHaveLength(12);
    expect(l.schedule[11].balance).toBe(0);
    expect(l.totalInterest).toBeCloseTo(66_185.45, 0);
  });
  it("zero-interest loan splits evenly", () => {
    const l = loanRepayment(1_200, 0, 12);
    expect(l.monthlyPayment).toBe(100);
    expect(l.totalInterest).toBe(0);
  });
  it("loan validates term", () => {
    expect(() => loanRepayment(1000, 10, 0)).toThrow();
  });
  it("simple payback only when cash flow is positive", () => {
    expect(simplePayback(2_000_000, 150_000)).toBe(13.3);
    expect(simplePayback(2_000_000, -10)).toBeNull();
  });
  it("trend compares last 3 months vs prior 3", () => {
    expect(trendPct([100, 100, 100, 110, 110, 110])).toBe(10);
    expect(trendPct([1, 2])).toBeNull();
  });
});

describe("Nova Retail demo scenario", () => {
  const b = novaRetail();
  const s = summarize(b);

  it("summary matches the blueprint figures", () => {
    expect(s.revenue).toBe(3_500_000);
    expect(s.totalExpenses).toBe(2_800_000);
    expect(s.netProfit).toBe(700_000);
    expect(s.essentialMonthly).toBe(1_050_000);
    expect(s.reserveMonths).toBe(4.8);
  });

  it("demo history closing cash is internally consistent", () => {
    const h = b.history;
    for (let i = 1; i < h.length; i++) {
      const net = h[i].revenue - h[i].variableCosts - h[i].fixedCosts - h[i].debtRepayment;
      expect(h[i].closingCash).toBe(h[i - 1].closingCash + net);
    }
    expect(h[h.length - 1].closingCash).toBe(b.cashBalance);
  });

  it("health score is deterministic and in range", () => {
    const a = computeHealthScore(b);
    const again = computeHealthScore(b);
    expect(a.total).toBe(again.total);
    expect(a.total).toBeGreaterThanOrEqual(0);
    expect(a.total).toBeLessThanOrEqual(100);
    expect(a.dimensions.reduce((acc, d) => acc + d.weight, 0)).toBe(100);
  });

  it("the current business passes the reserve policy", () => {
    const risks = detectRisks(b, DEFAULT_POLICIES);
    expect(risks.find((r) => r.id === "policy_reserve")).toBeUndefined();
    // Expenses have grown faster than revenue in the demo data
    expect(risks.find((r) => r.id === "expense_growth")).toBeDefined();
  });

  it("opening a branch now breaks the reserve policy by 1.5M", () => {
    const sim = simulateDecision(b, "open_branch", NOVA_BRANCH_INPUTS, DEFAULT_POLICIES);
    const exp = sim.scenarios.expected;
    expect(exp.cashAfterInvestment).toBe(3_000_000);
    expect(exp.decisionMonthlyProfit).toBe(150_000);
    expect(exp.businessMonthlyProfit).toBe(850_000);
    const reserve = exp.policyChecks.find((c) => c.policy.type === "minimum_cash_reserve")!;
    expect(reserve.passed).toBe(false);
    expect(reserve.required).toBe(4_500_000); // 3 × (1.05M + 450k branch fixed costs)
    expect(reserve.violation!.amount).toBe(1_500_000);
    expect(exp.simplePaybackMonths).toBe(13.3);
  });

  it("pessimistic scenario makes the branch loss-making", () => {
    const sim = simulateDecision(b, "open_branch", NOVA_BRANCH_INPUTS, DEFAULT_POLICIES);
    const p = sim.scenarios.pessimistic;
    expect(p.decisionMonthlyProfit).toBe(-90_000);
    expect(p.breaksEven).toBe(false);
    expect(p.additionalRevenueToBreakEven).toBe(180_000);
    expect(p.paybackMonth).toBeNull();
  });

  it("waiting 3 months keeps the reserve intact", () => {
    const sim = simulateDecision(b, "open_branch", NOVA_BRANCH_INPUTS, DEFAULT_POLICIES, { startDelayMonths: 3 });
    const exp = sim.scenarios.expected;
    expect(exp.cashAfterInvestment).toBe(5_100_000);
    expect(exp.policyChecks.find((c) => c.policy.type === "minimum_cash_reserve")!.passed).toBe(true);
  });

  it("recovery plan is generated with concrete tasks", () => {
    const plan = buildRecoveryPlan(b, s, detectRisks(b, DEFAULT_POLICIES));
    expect(plan.length).toBeGreaterThan(4);
    expect(plan.every((t) => t.week >= 1 && t.week <= 4)).toBe(true);
  });
});

describe("decision impacts", () => {
  const b = novaRetail();
  it("price increase accounts for lost volume", () => {
    const i = toImpact("raise_prices", { increasePct: 10, volumeLossPct: 5 }, b);
    // 3.5M × 1.1 × 0.95 − 3.5M = 157,500
    expect(i.monthlyRevenue).toBe(157_500);
    expect(i.monthlyVariableCost).toBe(-87_500);
  });
  it("loan repayments become essential expenses", () => {
    const i = toImpact("take_loan", { principal: 1_000_000, ratePct: 12, term: 12, revenueGain: 0, spend: 0 }, b);
    expect(i.upfrontInflow).toBe(1_000_000);
    expect(i.monthlyEssentialCost).toBeCloseTo(88_848.79, 2);
  });
  it("debt service policy flags heavy repayments", () => {
    const c = checkPolicy(DEFAULT_POLICIES[1], {
      cash: 0,
      essentialMonthly: 0,
      revenue: 1_000_000,
      variableCosts: 0,
      debtRepayment: 250_000,
      largestOutlay: 0,
      context: "today",
    });
    expect(c.passed).toBe(false);
    expect(c.violation!.amount).toBe(10);
  });
  it("inventory revenue stops after the sell-through period", () => {
    const sim = simulateDecision(b, "buy_inventory", { amount: 600_000, markupPct: 50, sellMonths: 3 }, DEFAULT_POLICIES);
    const months = sim.scenarios.expected.months;
    expect(months[0].decisionNet).toBe(300_000);
    expect(months[3].decisionNet).toBe(0);
  });
});
