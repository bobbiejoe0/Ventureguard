"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, LifeBuoy, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, cx, PageHeader, Pill } from "@/components/ui";
import { AiAnswer } from "@/components/AiAnswer";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { useAi } from "@/lib/ai/useAi";
import { buildContext, recoveryPlanPrompt } from "@/lib/ai/prompts";
import { buildRecoveryPlan } from "@/engine/recovery";
import { formatMoney } from "@/engine/money";

const DONE_KEY = "ventureguard.recoveryDone.v1";

export default function RecoveryPage() {
  const a = useAnalysis();
  const ai = useAi();
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDone(JSON.parse(localStorage.getItem(DONE_KEY) || "[]"));
    } catch {}
  }, []);
  const plan = useMemo(() => (a ? buildRecoveryPlan(a.business, a.summary, a.risks) : []), [a]);
  if (!a) return null;
  const cur = a.business.currency;
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {}
  };
  const impact = plan.reduce((acc, t) => acc + (t.estimatedMonthlyImpact ?? 0), 0);
  const pct = plan.length ? Math.round((done.filter((d) => plan.some((t) => t.id === d)).length / plan.length) * 100) : 0;
  const ctx = buildContext(a.business, a.summary, a.health, a.risks);

  return (
    <>
      <PageHeader
        title="Recovery Mode"
        subtitle="A practical 30-day plan built by the rule engine from your risks and figures. Impact estimates use the labelled percentages in each task."
      />
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Progress</div>
          <div className="num mt-1 text-2xl font-semibold">{pct}%</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-50">
            <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Estimated monthly cash improvement</div>
          <div className="num mt-1 text-2xl font-semibold text-good">+{formatMoney(impact, cur)}</div>
          <div className="text-[12px] text-muted">Sum of tasks with a calculable impact</div>
        </Card>
        <Card className="p-5">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Current monthly result</div>
          <div className={cx("num mt-1 text-2xl font-semibold", a.summary.netProfit >= 0 ? "text-good" : "text-bad")}>{formatMoney(a.summary.netProfit, cur)}</div>
          <div className="text-[12px] text-muted">{a.risks.length} active risk(s)</div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {([1, 2, 3, 4] as const).map((w) => (
          <Card key={w}>
            <CardHeader title={`Week ${w}`} icon={<LifeBuoy className="h-4 w-4" />} />
            <div className="space-y-2 p-4">
              {plan
                .filter((t) => t.week === w)
                .map((t) => (
                  <button key={t.id} onClick={() => toggle(t.id)} className={cx("w-full rounded-xl border p-3 text-left transition", done.includes(t.id) ? "border-good/30 bg-good-soft/50" : "border-line hover:border-navy-600")}>
                    <div className="flex items-start gap-2">
                      {done.includes(t.id) ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                      <div>
                        <div className={cx("text-[13px] font-semibold", done.includes(t.id) && "line-through opacity-70")}>{t.title}</div>
                        <p className="mt-1 text-[12px] text-navy-800">{t.detail}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Pill tone={t.priority === "high" ? "bad" : t.priority === "medium" ? "warn" : "neutral"}>{t.priority} priority</Pill>
                          {t.estimatedMonthlyImpact ? <Pill tone="good">+{formatMoney(t.estimatedMonthlyImpact, cur, true)}/mo</Pill> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader title="Walk me through this plan" subtitle="Longer explanation, generated in the cloud" icon={<Sparkles className="h-4 w-4" />} />
        <div className="space-y-3 p-5 pt-3">
          <Button
            loading={ai.loading}
            onClick={() =>
              ai.run({
                question: "Explain my 30-day recovery plan",
                prompt: recoveryPlanPrompt(ctx, plan.map((t) => `Week ${t.week}: ${t.title}. ${t.detail}`)),
                context: { ...ctx, plan: plan.map((t) => t.detail) },
                route: "detailed",
              })
            }
          >
            Explain the plan (cloud)
          </Button>
          {ai.error && <p className="text-[13px] text-bad">{ai.error}</p>}
          {ai.result && <AiAnswer run={ai.result} />}
        </div>
      </Card>
    </>
  );
}
