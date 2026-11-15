"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  Building2,
  CheckCircle2,
  Factory,
  Megaphone,
  PackagePlus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { Button, Card, CardHeader, cx, Field, NumberInput, PageHeader, Pill, SeverityBadge } from "@/components/ui";
import { ScenarioCashChart } from "@/components/charts";
import { AiAnswer } from "@/components/AiAnswer";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { newId, useWorkspace, type SavedSimulation } from "@/lib/store/workspace";
import { useAi } from "@/lib/ai/useAi";
import { buildContext, detailedAnalysisPrompt, quickInsightPrompt } from "@/lib/ai/prompts";
import { DECISION_TEMPLATES, getTemplate, type DecisionType } from "@/engine/decisions";
import { DEFAULT_ASSUMPTIONS, simulateDecision, type ScenarioResult, type SimulationAssumptions, type SimulationResult } from "@/engine/scenarios";
import { essentialMonthlyExpenses } from "@/engine/calculations";
import { formatMoney } from "@/engine/money";
import type { Business } from "@/engine/types";

const ICONS: Record<DecisionType, typeof Building2> = {
  open_branch: Building2,
  hire_staff: Users,
  take_loan: Banknote,
  buy_equipment: Factory,
  raise_prices: Tag,
  launch_product: PackagePlus,
  increase_advertising: Megaphone,
  buy_inventory: Boxes,
};

const PRESETS: Record<DecisionType, Record<string, number>> = {
  open_branch: { investment: 2_000_000, monthlyRevenue: 1_200_000, monthlyFixed: 450_000 },
  hire_staff: { count: 2, salary: 120_000, onboarding: 50_000, revenueGain: 300_000 },
  take_loan: { principal: 2_000_000, ratePct: 24, term: 18, revenueGain: 400_000, spend: 2_000_000 },
  buy_equipment: { cost: 900_000, savings: 60_000, revenueGain: 100_000, maintenance: 15_000 },
  raise_prices: { increasePct: 8, volumeLossPct: 4 },
  launch_product: { launchCost: 800_000, monthlyRevenue: 500_000, monthlyFixed: 80_000 },
  increase_advertising: { monthlySpend: 150_000, upliftPct: 6 },
  buy_inventory: { amount: 1_000_000, markupPct: 40, sellMonths: 4 },
};

/** Example values, scaled to the business size. Shown as editable examples, never silently applied. */
function presetFor(type: DecisionType, b: Business) {
  const scale = b.monthlyRevenue > 0 ? b.monthlyRevenue / 3_500_000 : 1;
  const t = getTemplate(type);
  const out: Record<string, number> = {};
  const defaults: string[] = [];
  for (const f of t.fields) {
    if (f.defaultFrom) {
      out[f.key] = f.defaultFrom(b);
      defaults.push(f.key);
    } else {
      const v = PRESETS[type][f.key] ?? 0;
      out[f.key] = f.kind === "money" ? Math.round((v * scale) / 10_000) * 10_000 : v;
    }
  }
  return { inputs: out, defaults };
}

function verdict(sim: SimulationResult) {
  const e = sim.scenarios.expected;
  const p = sim.scenarios.pessimistic;
  const violations = e.policyChecks.filter((c) => !c.passed);
  if (e.firstNegativeCashMonth !== null) return { tone: "bad" as const, title: "High risk: cash runs out", text: `In the expected case, cash goes negative in month ${e.firstNegativeCashMonth}.` };
  if (violations.some((v) => v.violation!.severity === "critical" || v.violation!.severity === "high"))
    return { tone: "bad" as const, title: "Not recommended as proposed", text: `It breaks ${violations.length} business polic${violations.length === 1 ? "y" : "ies"}. Adjust the amount or timing below.` };
  if (violations.length || !p.breaksEven) return { tone: "warn" as const, title: "Proceed with caution", text: violations.length ? `${violations.length} policy warning(s) need review.` : "The pessimistic case loses money each month." };
  return { tone: "good" as const, title: "Within your policies", text: "All enabled policies pass in the expected case." };
}

function ScenarioColumn({ s, cur, highlight }: { s: ScenarioResult; cur: string; highlight?: boolean }) {
  const fails = s.policyChecks.filter((c) => !c.passed);
  const row = (label: string, value: React.ReactNode, tone?: "good" | "bad") => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={cx("num whitespace-nowrap text-right text-[13px] font-semibold", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{value}</span>
    </div>
  );
  return (
    <div className={cx("lift rounded-2xl border p-4", highlight ? "border-navy-700 bg-navy-50/50 ring-1 ring-navy-700/10" : "border-line bg-white")}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{s.label}</span>
        <span className="text-[11px] text-muted">revenue ×{s.revenueFactor}</span>
      </div>
      <div className="mt-2 divide-y divide-line">
        {row("Cash after investment", formatMoney(s.cashAfterInvestment, cur), s.cashAfterInvestment < 0 ? "bad" : undefined)}
        {row("Decision profit / month", formatMoney(s.decisionMonthlyProfit, cur), s.decisionMonthlyProfit >= 0 ? "good" : "bad")}
        {row("Business profit / month", formatMoney(s.businessMonthlyProfit, cur), s.businessMonthlyProfit >= 0 ? "good" : "bad")}
        {row("Lowest cash point", `${formatMoney(s.minCash, cur)}${s.minCashMonth ? ` (M${s.minCashMonth})` : ""}`, s.minCash < 0 ? "bad" : undefined)}
        {row(`Cash in month ${s.months.length}`, formatMoney(s.endingCash, cur))}
        {row(
          "Cash runway",
          s.runway.kind === "positive_cash_flow" ? "Cash-flow positive" : s.runway.kind === "runway" ? `${s.runway.months} months` : "No cash",
          s.runway.kind === "positive_cash_flow" ? "good" : "bad",
        )}
        {row("Break-even", s.breaksEven ? "Yes" : s.additionalRevenueToBreakEven ? `Needs +${formatMoney(s.additionalRevenueToBreakEven, cur, true)}/mo` : "No", s.breaksEven ? "good" : "bad")}
        {row("Investment recovered", s.paybackMonth ? `Month ${s.paybackMonth}` : s.upfrontCost > 0 ? `Not within ${s.months.length} mo` : "n/a")}
      </div>
      <div className="mt-3">
        {fails.length === 0 ? (
          <Pill tone="good">
            <CheckCircle2 className="h-3 w-3" /> Policies pass
          </Pill>
        ) : (
          <Pill tone="bad">
            <ShieldAlert className="h-3 w-3" /> {fails.length} policy violation{fails.length > 1 ? "s" : ""}
          </Pill>
        )}
      </div>
    </div>
  );
}

export default function DecisionLab() {
  const a = useAnalysis();
  const { simulations, saveSimulation, deleteSimulation } = useWorkspace();
  const [type, setType] = useState<DecisionType>("open_branch");
  const [inputs, setInputs] = useState<Record<string, number> | null>(null);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<SimulationAssumptions>(DEFAULT_ASSUMPTIONS);
  const [title, setTitle] = useState("Open a second branch");
  const [baseline, setBaseline] = useState<{ label: string; sim: SimulationResult } | null>(null);
  const [saved, setSaved] = useState(false);
  const ai = useAi();

  const b = a?.business;
  const effectiveInputs = useMemo(() => {
    if (!b) return {};
    return inputs ?? presetFor(type, b).inputs;
  }, [inputs, type, b]);
  const effectiveDefaults = inputs ? defaults : b ? presetFor(type, b).defaults : [];

  const sim = useMemo(() => (a ? simulateDecision(a.business, type, effectiveInputs, a.policies, assumptions) : null), [a, type, effectiveInputs, assumptions]);

  if (!a || !b || !sim) return null;
  const cur = b.currency;
  const template = getTemplate(type);
  const v = verdict(sim);
  const reservePolicy = a.policies.find((p) => p.type === "minimum_cash_reserve" && p.enabled);
  const reserveRequired = reservePolicy ? reservePolicy.threshold * (essentialMonthlyExpenses(b) + sim.impact.monthlyEssentialCost) : null;
  const expected = sim.scenarios.expected;
  const failures = expected.policyChecks.filter((c) => !c.passed);
  const ctx = buildContext(b, a.summary, a.health, a.risks, sim);

  const pickType = (t: DecisionType) => {
    setType(t);
    const p = presetFor(t, b);
    setInputs(p.inputs);
    setDefaults(p.defaults);
    setTitle(getTemplate(t).title);
    setBaseline(null);
    setSaved(false);
    ai.setResult(null);
  };
  const setInput = (k: string, val: number) => {
    if (!baseline) setBaseline({ label: "your first version", sim });
    setInputs({ ...effectiveInputs, [k]: val });
    setDefaults((d) => d.filter((x) => x !== k));
    setSaved(false);
  };
  const setAssumption = <K extends keyof SimulationAssumptions>(k: K, val: SimulationAssumptions[K]) => {
    if (!baseline) setBaseline({ label: "your first version", sim });
    setAssumptions((s) => ({ ...s, [k]: val }));
    setSaved(false);
  };

  const save = async () => {
    const rec: SavedSimulation = {
      id: newId(),
      title,
      decisionType: type,
      inputs: effectiveInputs,
      assumptions,
      headline: { expectedMonthlyProfit: expected.decisionMonthlyProfit, lowestCash: expected.minCash, violations: failures.length },
      createdAt: new Date().toISOString(),
    };
    await saveSimulation(rec);
    setSaved(true);
  };

  const diff = baseline
    ? (() => {
        const be = baseline.sim.scenarios.expected;
        const bf = be.policyChecks.filter((c) => !c.passed).length;
        return { lowest: expected.minCash - be.minCash, ending: expected.endingCash - be.endingCash, violationsBefore: bf, violationsAfter: failures.length };
      })()
    : null;

  return (
    <>
      <PageHeader
        title="Decision Lab"
        subtitle="Simulate a decision before you commit money. Every figure is computed by the deterministic engine. Change any assumption and results update instantly."
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {DECISION_TEMPLATES.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <button
              key={t.type}
              onClick={() => pickType(t.type)}
              className={cx(
                "flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-[12px] font-medium transition duration-200 hover:-translate-y-0.5",
                type === t.type ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-navy-900 hover:border-navy-600",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.title}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-semibold">{template.title}</h3>
            <p className="mt-0.5 text-[13px] text-muted">{template.description}</p>
            <div className="mt-4 space-y-4">
              <Field label="Name this decision">
                <input className="h-10 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              {template.fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  help={f.help}
                  badge={effectiveDefaults.includes(f.key) ? <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#a86b12]">Default assumption</span> : undefined}
                >
                  <NumberInput
                    value={effectiveInputs[f.key] ?? 0}
                    onChange={(n) => setInput(f.key, n)}
                    prefix={f.kind === "money" ? "₦" : undefined}
                    suffix={f.kind === "percent" ? "%" : f.kind === "months" ? "months" : undefined}
                    step={f.kind === "money" ? 50_000 : 1}
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold">Assumptions</h3>
            <p className="mt-0.5 text-[13px] text-muted">These are labelled defaults. Change them to match your situation.</p>
            <div className="mt-4 space-y-4">
              <Field group label="When to start" help="Waiting lets your current surplus build reserves first.">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4, 6].map((m) => (
                    <button
                      key={m}
                      onClick={() => setAssumption("startDelayMonths", m)}
                      className={cx("h-9 flex-1 rounded-lg border text-[12px] font-medium", assumptions.startDelayMonths === m ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white hover:border-navy-600")}
                    >
                      {m === 0 ? "Now" : `+${m}m`}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Optimistic ×" help="Revenue vs your estimate">
                  <NumberInput value={assumptions.optimisticFactor} step={0.05} onChange={(n) => setAssumption("optimisticFactor", n)} />
                </Field>
                <Field label="Pessimistic ×" help="Revenue vs your estimate">
                  <NumberInput value={assumptions.pessimisticFactor} step={0.05} onChange={(n) => setAssumption("pessimisticFactor", n)} />
                </Field>
              </div>
              <Field label="Projection horizon">
                <NumberInput value={assumptions.horizonMonths} suffix="months" onChange={(n) => setAssumption("horizonMonths", Math.min(36, Math.max(3, Math.round(n))))} />
              </Field>
              {sim.impact.rampUp && (
                <p className="rounded-lg bg-navy-50 px-3 py-2 text-[12px] text-navy-800">
                  <b>Ramp-up assumption:</b> new revenue reaches {assumptions.rampUp.map((r) => `${Math.round(r * 100)}%`).join(", ")} of your estimate in months 1–{assumptions.rampUp.length}, then 100%.
                </p>
              )}
              {sim.impact.notes.map((n) => (
                <p key={n} className="text-[12px] text-muted">• {n}</p>
              ))}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <div
            className={cx(
              "flex flex-wrap items-center gap-4 rounded-2xl border p-5 transition-colors duration-500",
              v.tone === "bad" && "border-bad/30 bg-bad-soft",
              v.tone === "warn" && "border-warn/40 bg-warn-soft",
              v.tone === "good" && "border-good/30 bg-good-soft",
            )}
          >
            {v.tone === "good" ? <ShieldCheck className="h-8 w-8 text-good" /> : <AlertTriangle className={cx("h-8 w-8", v.tone === "bad" ? "text-bad" : "text-warn")} />}
            <div className="flex-1">
              <div className="text-lg font-semibold">{v.title}</div>
              <div className="text-[13px] text-navy-800">{v.text}</div>
            </div>
            <Button variant="secondary" onClick={save} disabled={saved}>
              <Save className="h-4 w-4" /> {saved ? "Saved" : "Save simulation"}
            </Button>
          </div>

          {diff && (
            <Card className="scale-in flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-[13px]">
              <span className="font-semibold">Compared with {baseline!.label}:</span>
              <span>
                Lowest cash <b className={cx("num", diff.lowest >= 0 ? "text-good" : "text-bad")}>{diff.lowest >= 0 ? "+" : ""}{formatMoney(diff.lowest, cur)}</b>
              </span>
              <span>
                Cash in month {assumptions.horizonMonths} <b className={cx("num", diff.ending >= 0 ? "text-good" : "text-bad")}>{diff.ending >= 0 ? "+" : ""}{formatMoney(diff.ending, cur)}</b>
              </span>
              <span>
                Policy violations <b className="num">{diff.violationsBefore}</b> <ArrowRight className="inline h-3 w-3" /> <b className={cx("num", diff.violationsAfter < diff.violationsBefore ? "text-good" : "")}>{diff.violationsAfter}</b>
              </span>
              <button className="ml-auto text-[12px] text-navy-700 hover:underline" onClick={() => setBaseline({ label: "the previous version", sim })}>
                Set current as comparison point
              </button>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {(["optimistic", "expected", "pessimistic"] as const).map((k, i) => (
              <div key={k} className="fade-up" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                <ScenarioColumn s={sim.scenarios[k]} cur={cur} highlight={k === "expected"} />
              </div>
            ))}
          </div>

          <Card>
            <CardHeader title="Projected cash position" subtitle={`Month by month for ${assumptions.horizonMonths} months, compared with not making this decision`} />
            <div className="px-2 pb-4 pt-2">
              <ScenarioCashChart scenarios={sim.scenarios} currency={cur} reserve={reserveRequired} startCash={b.cashBalance} />
            </div>
          </Card>

          <Card>
            <CardHeader title="PolicyGuard" subtitle="Checked against the expected scenario's lowest cash point. Warnings only: you stay in control." icon={<ShieldCheck className="h-4 w-4" />} />
            <div className="space-y-3 p-5 pt-3">
              {expected.policyChecks.length === 0 && <p className="text-sm text-muted">No policies enabled.</p>}
              {expected.policyChecks.map((c) =>
                c.passed ? (
                  <div key={c.policy.id} className="flex items-start gap-3 rounded-xl border border-line p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                    <div>
                      <div className="text-[13px] font-medium">{c.policy.description}</div>
                      <div className="num text-[12px] text-muted">{c.detail}</div>
                    </div>
                  </div>
                ) : (
                  <div key={c.policy.id} className="rounded-xl border border-bad/30 bg-bad-soft/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-bad" />
                      <span className="text-[14px] font-semibold">{c.policy.description}</span>
                      <SeverityBadge severity={c.violation!.severity} />
                    </div>
                    <p className="num mt-2 text-[13px] font-medium text-navy-900">{c.violation!.message}</p>
                    <div className="mt-2 grid gap-3 text-[13px] md:grid-cols-2">
                      <div>
                        <div className="font-semibold">Why it matters</div>
                        <p className="text-navy-800">{c.violation!.whyItMatters}</p>
                      </div>
                      <div>
                        <div className="font-semibold">Lower-risk alternative</div>
                        <p className="text-navy-800">{c.violation!.alternative}</p>
                      </div>
                    </div>
                    <p className="num mt-2 text-[12px] text-muted">{c.detail}</p>
                  </div>
                ),
              )}
            </div>
          </Card>

          {expected.risks.length > 0 && (
            <Card>
              <CardHeader title="Risks of this decision" subtitle="Expected scenario" icon={<AlertTriangle className="h-4 w-4" />} />
              <ul className="space-y-2 p-5 pt-3 text-[13px]">
                {expected.risks.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />
                    {r}
                  </li>
                ))}
                {sim.scenarios.pessimistic.risks
                  .filter((r) => !expected.risks.includes(r))
                  .map((r) => (
                    <li key={r} className="flex gap-2 text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                      Pessimistic case: {r}
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Explain this simulation" subtitle="AI explains the engine's results. It never changes them." icon={<Sparkles className="h-4 w-4" />} />
            <div className="space-y-3 p-5 pt-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  loading={ai.loading}
                  onClick={() =>
                    ai.run({
                      question: `Quick take: ${title}`,
                      prompt: quickInsightPrompt(ctx, `Should I go ahead with "${title}" as currently planned? Explain the main risk.`),
                      context: ctx,
                      route: "quick",
                    })
                  }
                >
                  <Sparkles className="h-4 w-4" /> Quick insight (on-device first)
                </Button>
                <Button
                  loading={ai.loading}
                  onClick={() =>
                    ai.run({
                      question: `Detailed analysis: ${title}`,
                      prompt: detailedAnalysisPrompt(ctx, `Analyse the decision "${title}". Why could it put the existing business at risk, and what would a safer version look like?`),
                      context: ctx,
                      route: "detailed",
                    })
                  }
                >
                  Detailed analysis (cloud)
                </Button>
              </div>
              {ai.error && <p className="text-[13px] text-bad">{ai.error}</p>}
              {ai.result && <AiAnswer run={ai.result} />}
            </div>
          </Card>
        </div>
      </div>

      {simulations.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Saved simulations" />
          <div className="divide-y divide-line px-5 pb-2">
            {simulations.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-48 flex-1">
                  <div className="text-[14px] font-medium">{s.title}</div>
                  <div className="text-[12px] text-muted">
                    {getTemplate(s.decisionType).title} · {s.assumptions.startDelayMonths ? `starts in ${s.assumptions.startDelayMonths} months` : "starts now"} · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="num text-[13px]">Lowest cash {formatMoney(s.headline.lowestCash, cur, true)}</span>
                {s.headline.violations ? <Pill tone="bad">{s.headline.violations} violation(s)</Pill> : <Pill tone="good">Policies pass</Pill>}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setType(s.decisionType);
                    setInputs(s.inputs);
                    setDefaults([]);
                    setAssumptions(s.assumptions);
                    setTitle(s.title);
                    setBaseline(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Open
                </Button>
                <button onClick={() => deleteSimulation(s.id)} className="text-muted hover:text-bad" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
