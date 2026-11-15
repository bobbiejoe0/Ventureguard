import type { Business } from "@/engine/types";
import type { FinancialSummary } from "@/engine/calculations";
import type { HealthScore } from "@/engine/healthScore";
import type { Risk } from "@/engine/risks";
import type { SimulationResult } from "@/engine/scenarios";
import { getTemplate } from "@/engine/decisions";

/**
 * Builds a compact, structured snapshot for the model. Only aggregate figures are sent:
 * no owner name, email, or transaction-level data. Gemini Nano has a small context window,
 * so the snapshot stays short.
 */
export function buildContext(
  b: Business,
  s: FinancialSummary,
  health: HealthScore,
  risks: Risk[],
  sim?: SimulationResult | null,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    business: { industry: b.industry, type: b.businessType, currency: b.currency, employees: b.employees, branches: b.branches },
    monthly: {
      revenue: s.revenue,
      variableCosts: s.variableCosts,
      fixedCosts: s.fixedCosts,
      debtRepayment: s.debtRepayment,
      totalExpenses: s.totalExpenses,
      netProfit: s.netProfit,
      grossMarginPct: s.grossMarginPct,
      netMarginPct: s.netMarginPct,
      breakEvenRevenue: s.breakEven.breakEvenRevenue,
    },
    cash: s.cash,
    essentialMonthlyExpenses: s.essentialMonthly,
    reserveMonths: s.reserveMonths,
    outstandingDebt: b.outstandingDebt,
    inventoryValue: b.inventoryValue,
    healthScore: { total: health.total, grade: health.grade, weakest: [...health.dimensions].sort((a, c) => a.score - c.score).slice(0, 2).map((d) => `${d.label} ${d.score}/100`) },
    risks: risks.slice(0, 4).map((r) => `${r.severity.toUpperCase()}: ${r.title} (${r.evidence[0]})`),
  };
  if (sim) {
    const e = sim.scenarios.expected;
    const p = sim.scenarios.pessimistic;
    const violations = e.policyChecks.filter((c) => !c.passed).map((c) => c.violation!.message);
    ctx.proposedDecision = {
      type: getTemplate(sim.decisionType).title,
      inputs: sim.inputs,
      startsInMonths: sim.assumptions.startDelayMonths,
      upfrontCost: e.upfrontCost,
      cashAfterInvestment: e.cashAfterInvestment,
      expected: { decisionMonthlyProfit: e.decisionMonthlyProfit, lowestCash: e.minCash, paybackMonth: e.paybackMonth, endingCash: e.endingCash },
      pessimistic: { decisionMonthlyProfit: p.decisionMonthlyProfit, lowestCash: p.minCash, extraRevenueNeededToBreakEven: p.additionalRevenueToBreakEven },
      policyViolations: violations,
      risks: e.risks.slice(0, 3),
    };
  }
  return ctx;
}

const RULES = `Rules:
- Use ONLY the figures in the DATA block. Do not invent, estimate or recalculate numbers.
- If the data does not answer the question, say what is missing.
- Write for a busy small-business owner: plain English, no jargon.
- Do not give legal or tax advice.`;

export function quickInsightPrompt(ctx: Record<string, unknown>, question: string): string {
  return `You are VentureGuard, a careful business advisor. Answer the owner's question using the business data.

DATA:
${JSON.stringify(ctx)}

QUESTION: ${question}

${RULES}

Respond in under 170 words using exactly these headings:
Answer:
Evidence:
Why it matters:
Recommended next step:
Assumptions:`;
}

export function detailedAnalysisPrompt(ctx: Record<string, unknown>, question: string): string {
  return `You are VentureGuard, a senior business analyst. Write a thorough analysis for the owner.

DATA:
${JSON.stringify(ctx, null, 1)}

QUESTION: ${question}

${RULES}

Use these headings in order, in Markdown (## for headings, short bullet lists):
## Direct answer
## Supporting financial evidence
## Explanation
## Risks and opportunities
## Recommended next actions (numbered, most important first)
## Important assumptions
Keep it under 450 words.`;
}

export function explainMetricPrompt(metric: string, value: string, method: string, evidence: string[]): string {
  return `Explain this business health metric to a small-business owner in 3 short sentences. Use only the numbers given.
Metric: ${metric}
Score: ${value}
How it is calculated: ${method}
Figures: ${evidence.join("; ")}
End with one concrete action.`;
}

export function recoveryPlanPrompt(ctx: Record<string, unknown>, tasks: string[]): string {
  return `You are VentureGuard. The rule engine produced this 30-day recovery plan for a business. Explain, for the owner, why each week matters and in what order to act. Use only the figures given.

DATA:
${JSON.stringify(ctx)}

PLAN:
${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}

${RULES}
Respond in Markdown with a heading per week and 2–3 bullets each. Under 350 words.`;
}

// ---------- Output validation ----------

function collectNumbers(value: unknown, out: number[]) {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, out));
  else if (typeof value === "string") {
    for (const m of value.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) out.push(Number(m[0].replace(/,/g, "")));
  }
}

/** Parse figures like "₦1,500,000", "1.5M", "1.5 million", "₦850k" from model text. */
export function extractFigures(text: string): { raw: string; value: number }[] {
  const re = /(?:₦|NGN\s?|\$|N)?\s?(-?\d[\d,]*(?:\.\d+)?)\s?(million|m\b|k\b|thousand|bn|billion)?/gi;
  const out: { raw: string; value: number }[] = [];
  for (const m of text.matchAll(re)) {
    let v = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    const unit = (m[2] || "").toLowerCase();
    if (unit === "million" || unit === "m") v *= 1e6;
    else if (unit === "k" || unit === "thousand") v *= 1e3;
    else if (unit === "bn" || unit === "billion") v *= 1e9;
    // Only check money-sized figures; small numbers (months, %, counts) are too ambiguous.
    if (Math.abs(v) >= 1000) out.push({ raw: m[0].trim(), value: v });
  }
  return out;
}

export interface ValidationReport {
  checked: number;
  unverified: string[];
}

/** Flags money figures in the AI response that don't match any engine figure (±2%, or derivable sums/differences). */
export function validateFigures(text: string, ctx: Record<string, unknown>): ValidationReport {
  const known: number[] = [];
  collectNumbers(ctx, known);
  const abs = known.map(Math.abs).filter((n) => n >= 1000);
  const derived = new Set<number>(abs);
  for (const a of abs) for (const b of abs) derived.add(Math.abs(a - b));
  const figures = extractFigures(text);
  const unverified: string[] = [];
  for (const f of figures) {
    const v = Math.abs(f.value);
    let ok = false;
    for (const k of derived) {
      if (k === 0) continue;
      if (Math.abs(k - v) / k <= 0.02) {
        ok = true;
        break;
      }
    }
    if (!ok && !unverified.includes(f.raw)) unverified.push(f.raw);
  }
  return { checked: figures.length, unverified };
}
