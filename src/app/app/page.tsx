"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FlaskConical, Minus, Sparkles, X } from "lucide-react";
import { Button, Card, CardHeader, cx, LinkButton, PageHeader, SeverityBadge, Stat } from "@/components/ui";
import { CashTrendChart, ProfitTrendChart, RevenueExpenseChart } from "@/components/charts";
import { AiAnswer } from "@/components/AiAnswer";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { useWorkspace } from "@/lib/store/workspace";
import { useAi } from "@/lib/ai/useAi";
import { explainMetricPrompt } from "@/lib/ai/prompts";
import { formatMoney, formatPct } from "@/engine/money";
import type { DimensionScore } from "@/engine/healthScore";
import { getTemplate } from "@/engine/decisions";

function scoreTone(score: number) {
  return score >= 75 ? "#16A36A" : score >= 55 ? "#244B73" : score >= 35 ? "#E9A23B" : "#D94A4A";
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className="h-36 w-36">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#E3EAF3" strokeWidth="11" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={scoreTone(score)}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform="rotate(-90 64 64)"
        className="ring-draw"
        style={{ "--ring-c": `${c}` } as React.CSSProperties}
      />
      <text x="64" y="62" textAnchor="middle" className="num" fontSize="34" fontWeight="700" fill="#142B4A">
        {score}
      </text>
      <text x="64" y="82" textAnchor="middle" fontSize="11" fill="#5B6B80">
        out of 100
      </text>
    </svg>
  );
}

function TrendIcon({ t }: { t: DimensionScore["trend"] }) {
  if (t === "improving") return <ArrowUpRight className="h-3.5 w-3.5 text-good" />;
  if (t === "deteriorating") return <ArrowDownRight className="h-3.5 w-3.5 text-bad" />;
  return <Minus className="h-3.5 w-3.5 text-muted" />;
}

function DimensionDetail({ d, onClose }: { d: DimensionScore; onClose: () => void }) {
  const ai = useAi();
  const prompt = explainMetricPrompt(d.label, `${d.score}/100`, d.method, d.evidence);
  return (
    <div className="rounded-2xl border border-navy-100 bg-navy-50/60 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Why this score</div>
          <div className="mt-0.5 text-lg font-semibold">
            {d.label}: <span className="num">{d.score}</span>/100 <span className="text-sm font-normal text-muted">· weight {d.weight}%</span>
          </div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-navy-900" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-[13px] font-semibold">Figures that influenced it</div>
          <ul className="mt-1.5 space-y-1 text-[13px] text-navy-800">
            {d.evidence.map((e) => (
              <li key={e} className="num">• {e}</li>
            ))}
          </ul>
          <div className="mt-3 text-[13px] font-semibold">Direction</div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] capitalize">
            <TrendIcon t={d.trend} /> {d.trend === "unknown" ? "Not enough history" : d.trend}
          </div>
        </div>
        <div>
          <div className="text-[13px] font-semibold">How it's calculated</div>
          <p className="mt-1.5 text-[13px] text-navy-800">{d.method}</p>
          <div className="mt-3 text-[13px] font-semibold">What would improve it</div>
          <p className="mt-1 text-[13px] text-navy-800">{d.improveAction}</p>
        </div>
      </div>
      <div className="mt-4">
        {ai.result ? (
          <AiAnswer run={ai.result} />
        ) : (
          <Button variant="secondary" size="sm" loading={ai.loading} onClick={() => ai.run({ prompt, question: `Explain ${d.label} score`, context: { evidence: d.evidence, score: d.score }, route: "quick" })}>
            <Sparkles className="h-3.5 w-3.5" /> Explain in plain English (on-device first)
          </Button>
        )}
        {ai.error && <p className="mt-2 text-[12px] text-bad">{ai.error}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const a = useAnalysis();
  const { simulations, insights } = useWorkspace();
  const [open, setOpen] = useState<DimensionScore | null>(null);
  if (!a) return null;
  const { business: b, summary: s, health, risks } = a;
  const cur = b.currency;
  const runwayText =
    s.runway.kind === "positive_cash_flow" ? "Cash-flow positive" : s.runway.kind === "runway" ? `${s.runway.months} months` : "No cash";

  const actions = [
    ...risks.slice(0, 2).map((r) => ({ text: r.action, why: r.title, href: "/app/risks" })),
    ...[...health.dimensions]
      .sort((x, y) => x.score - y.score)
      .slice(0, 2)
      .map((d) => ({ text: d.improveAction, why: `${d.label} scores ${d.score}/100`, href: "/app" })),
  ].slice(0, 3);

  return (
    <>
      <PageHeader
        title={`Good day, ${b.name}`}
        subtitle="Your business at a glance. Every figure here is calculated by the VentureGuard engine from your own numbers."
        action={
          <LinkButton href="/app/decisions">
            <FlaskConical className="h-4 w-4" /> Simulate a decision
          </LinkButton>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="fade-up lg:col-span-1">
          <CardHeader title="Business Health Score" subtitle="Click a dimension to see why" />
          <div className="flex items-center gap-4 px-5 pb-2 pt-3">
            <ScoreRing score={health.total} />
            <div>
              <div className="text-xl font-semibold" style={{ color: scoreTone(health.total) }}>
                {health.grade}
              </div>
              <p className="mt-1 text-[13px] text-muted">Weighted across six dimensions using fixed, transparent formulas. No AI involved.</p>
            </div>
          </div>
          <div className="space-y-1 px-3 pb-4">
            {health.dimensions.map((d, i) => (
              <button
                key={d.key}
                onClick={() => setOpen(open?.key === d.key ? null : d)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-navy-50", open?.key === d.key && "bg-navy-50")}
              >
                <span className="w-40 shrink-0 text-[13px] text-navy-800">{d.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50">
                  <span className="grow-x block h-full rounded-full" style={{ width: `${d.score}%`, background: scoreTone(d.score), "--d": `${300 + i * 90}ms` } as React.CSSProperties} />
                </span>
                <span className="num w-8 text-right text-[13px] font-semibold">{d.score}</span>
                <TrendIcon t={d.trend} />
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          {open && <DimensionDetail key={open.key} d={open} onClose={() => setOpen(null)} />}
          <Card className="fade-up p-5" style={{ "--d": "100ms" } as React.CSSProperties}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <Stat label="Monthly revenue" value={formatMoney(s.revenue, cur)} sub={s.salesTargetGap > 0 ? `${formatMoney(s.salesTargetGap, cur, true)} below target` : "At or above target"} />
              <Stat label="Monthly expenses" value={formatMoney(s.totalExpenses, cur)} sub="Incl. debt repayments" />
              <Stat label="Net operating profit" value={formatMoney(s.netProfit, cur)} tone={s.netProfit >= 0 ? "good" : "bad"} sub={s.netMarginPct === null ? "—" : `${formatPct(s.netMarginPct)} margin`} />
              <Stat label="Gross margin" value={s.grossMarginPct === null ? "—" : formatPct(s.grossMarginPct)} sub={`Gross profit ${formatMoney(s.grossProfit, cur, true)}`} />
              <Stat label="Cash reserves" value={formatMoney(s.cash, cur)} sub={s.reserveMonths === null ? "—" : `${s.reserveMonths} months of essentials`} />
              <Stat label="Cash runway" value={runwayText} tone={s.runway.kind === "positive_cash_flow" ? "good" : "bad"} sub={s.runway.kind === "positive_cash_flow" ? `+${formatMoney(s.runway.monthlySurplus, cur, true)}/month` : `Burning ${formatMoney(s.runway.monthlyBurn, cur, true)}/month`} />
              <Stat label="Outstanding debt" value={formatMoney(b.outstandingDebt, cur)} sub={s.debtServiceRatioPct === null ? "" : `Repayments ${formatPct(s.debtServiceRatioPct)} of revenue`} />
              <Stat label="Break-even revenue" value={s.breakEven.breakEvenRevenue === null ? "—" : formatMoney(s.breakEven.breakEvenRevenue, cur)} sub={s.breakEven.revenueGap ? `${formatMoney(s.breakEven.revenueGap, cur, true)} short` : "Currently above break-even"} />
            </div>
          </Card>

          <div className="fade-up grid gap-5 md:grid-cols-2" style={{ "--d": "200ms" } as React.CSSProperties}>
            <Card>
              <CardHeader title="Active risks" subtitle={`${risks.length} detected by Risk Radar`} action={<Link href="/app/risks" className="text-[13px] font-medium text-navy-700 hover:underline">View all</Link>} />
              <div className="space-y-2 p-5 pt-3">
                {risks.length === 0 && <p className="text-sm text-muted">No risks above your thresholds right now.</p>}
                {risks.slice(0, 3).map((r) => (
                  <div key={r.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold">{r.title}</span>
                      <SeverityBadge severity={r.severity} />
                    </div>
                    <div className="num mt-1 text-[12px] text-muted">{r.evidence[0]}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Recommended actions" subtitle="From your risks and weakest scores" />
              <ol className="space-y-3 p-5 pt-3">
                {actions.map((x, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[12px] font-semibold text-white">{i + 1}</span>
                    <div>
                      <div className="text-[13px] font-medium">{x.text}</div>
                      <div className="text-[12px] text-muted">{x.why}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>

      {b.history.length > 0 && (
        <div className="fade-up mt-5 grid gap-5 lg:grid-cols-3" style={{ "--d": "300ms" } as React.CSSProperties}>
          <Card className="lg:col-span-2">
            <CardHeader title="Revenue vs expenses" subtitle={`Last ${b.history.length} months`} />
            <div className="px-2 pb-4 pt-2">
              <RevenueExpenseChart history={b.history} currency={cur} />
            </div>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Profit trend" />
              <div className="px-2 pb-3 pt-2">
                <ProfitTrendChart history={b.history} currency={cur} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Cash flow trend" subtitle="Closing cash each month" />
              <div className="px-2 pb-3 pt-2">
                <CashTrendChart history={b.history} currency={cur} />
              </div>
            </Card>
          </div>
        </div>
      )}

      <Card className="mt-5">
        <CardHeader title="Recent activity" />
        <div className="divide-y divide-line px-5 pb-3">
          {simulations.length === 0 && insights.length === 0 && (
            <p className="py-4 text-sm text-muted">
              No simulations yet. <Link href="/app/decisions" className="font-medium text-navy-700 hover:underline">Run your first decision simulation <ArrowRight className="inline h-3 w-3" /></Link>
            </p>
          )}
          {[
            ...simulations.map((x) => ({ at: x.createdAt, text: `Simulated: ${x.title}`, sub: `${getTemplate(x.decisionType).title} · ${x.headline.violations} policy warning(s)` })),
            ...insights.map((x) => ({ at: x.createdAt, text: `Asked: ${x.question}`, sub: `Answered ${x.inferenceSource === "on_device" ? "on-device" : x.inferenceSource === "in_cloud" ? "in cloud" : ""}` })),
          ]
            .sort((x, y) => y.at.localeCompare(x.at))
            .slice(0, 6)
            .map((x, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-[13px] font-medium">{x.text}</div>
                  <div className="text-[12px] text-muted">{x.sub}</div>
                </div>
                <div className="text-[12px] text-muted">{new Date(x.at).toLocaleString("en-US")}</div>
              </div>
            ))}
        </div>
      </Card>
    </>
  );
}
