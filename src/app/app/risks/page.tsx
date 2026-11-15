"use client";

import { useEffect, useState } from "react";
import { Radar, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, Empty, PageHeader, SeverityBadge } from "@/components/ui";
import { AiAnswer } from "@/components/AiAnswer";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { useAi } from "@/lib/ai/useAi";
import { RISK_THRESHOLDS, type Risk } from "@/engine/risks";
import type { Severity } from "@/engine/types";

const HISTORY_KEY = "ventureguard.riskHistory.v1";

interface HistoryEntry {
  id: string;
  title: string;
  severity: Severity;
  firstSeen: string;
  lastSeen: string;
}

/** Keeps a per-device log of when each risk was first and last detected. */
function useRiskHistory(risks: Risk[]) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    let prev: HistoryEntry[] = [];
    try {
      prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {}
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map(prev.map((h) => [h.id, h]));
    for (const r of risks) {
      const e = map.get(r.id);
      map.set(r.id, e ? { ...e, severity: r.severity, title: r.title, lastSeen: today } : { id: r.id, title: r.title, severity: r.severity, firstSeen: today, lastSeen: today });
    }
    const next = [...map.values()].sort((x, y) => y.lastSeen.localeCompare(x.lastSeen));
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(next);
  }, [risks]);
  return history;
}

function RiskCard({ r }: { r: Risk }) {
  const ai = useAi();
  const prompt = `Explain this business risk to a small-business owner in 3 short sentences, then give one practical step. Use only these facts.
Risk: ${r.title}
Severity: ${r.severity}
Evidence: ${r.evidence.join("; ")}
Consequence: ${r.consequence}`;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={r.severity} />
        <h3 className="font-semibold">{r.title}</h3>
        <span className="ml-auto text-[12px] text-muted">Detected {r.detectedAt}</span>
      </div>
      <div className="mt-3 grid gap-4 text-[13px] md:grid-cols-3">
        <div>
          <div className="font-semibold">Evidence</div>
          <ul className="num mt-1 space-y-0.5 text-navy-800">
            {r.evidence.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold">Potential consequence</div>
          <p className="mt-1 text-navy-800">{r.consequence}</p>
        </div>
        <div>
          <div className="font-semibold">Recommended action</div>
          <p className="mt-1 text-navy-800">{r.action}</p>
        </div>
      </div>
      <div className="mt-4">
        {ai.result ? (
          <AiAnswer run={ai.result} />
        ) : (
          <Button size="sm" variant="ghost" loading={ai.loading} onClick={() => ai.run({ prompt, question: `Explain risk: ${r.title}`, context: { evidence: r.evidence }, route: "quick" })}>
            <Sparkles className="h-3.5 w-3.5" /> Explain this risk (on-device first)
          </Button>
        )}
        {ai.error && <p className="mt-2 text-[12px] text-bad">{ai.error}</p>}
      </div>
    </Card>
  );
}

export default function RiskRadarPage() {
  const a = useAnalysis();
  const history = useRiskHistory(a?.risks ?? []);
  if (!a) return null;
  const counts = (["critical", "high", "medium", "low"] as Severity[]).map((s) => ({ s, n: a.risks.filter((r) => r.severity === s).length }));

  return (
    <>
      <PageHeader
        title="Risk Radar"
        subtitle="Early warning signs, detected with explicit rules and thresholds. AI can explain a risk, but it never decides its severity."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(({ s, n }, i) => (
          <Card key={s} className="fade-up flex items-center justify-between p-4" style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
            <SeverityBadge severity={s} />
            <span className="num text-2xl font-semibold">{n}</span>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {a.risks.length === 0 ? (
            <Empty title="No active risks">Your business is inside every threshold right now.</Empty>
          ) : (
            a.risks.map((r, i) => (
              <div key={r.id} className="fade-up" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                <RiskCard r={r} />
              </div>
            ))
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Detection thresholds" icon={<Radar className="h-4 w-4" />} />
            <div className="space-y-2 p-5 pt-3 text-[12px] text-navy-800">
              <p>Expenses outpacing revenue: medium ≥{RISK_THRESHOLDS.expenseGrowthGapPct.medium} pts, high ≥{RISK_THRESHOLDS.expenseGrowthGapPct.high}, critical ≥{RISK_THRESHOLDS.expenseGrowthGapPct.critical}</p>
              <p>Cash reserve: medium &lt;{RISK_THRESHOLDS.reserveMonths.medium} months, high &lt;{RISK_THRESHOLDS.reserveMonths.high}, critical &lt;{RISK_THRESHOLDS.reserveMonths.critical}</p>
              <p>Debt repayments: medium ≥{RISK_THRESHOLDS.debtServicePct.medium}% of revenue, high ≥{RISK_THRESHOLDS.debtServicePct.high}%, critical ≥{RISK_THRESHOLDS.debtServicePct.critical}%</p>
              <p>Inventory: medium ≥{RISK_THRESHOLDS.inventoryMonths.medium} months of stock, high ≥{RISK_THRESHOLDS.inventoryMonths.high}</p>
              <p>Gross margin decline: medium ≥{RISK_THRESHOLDS.marginDeclinePts.medium} pts, high ≥{RISK_THRESHOLDS.marginDeclinePts.high}</p>
              <p>Falling sales: medium ≥{RISK_THRESHOLDS.salesDeclinePct.medium}%, high ≥{RISK_THRESHOLDS.salesDeclinePct.high}%, critical ≥{RISK_THRESHOLDS.salesDeclinePct.critical}%</p>
              <p>Plus any breach of your enabled PolicyGuard policies.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Risk history" subtitle="On this device" />
            <div className="divide-y divide-line px-5 pb-3">
              {history.length === 0 && <p className="py-3 text-[13px] text-muted">No risks recorded yet.</p>}
              {history.map((h) => (
                <div key={h.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{h.title}</span>
                    <SeverityBadge severity={h.severity} />
                  </div>
                  <div className="text-[11px] text-muted">
                    First seen {h.firstSeen} · last seen {h.lastSeen}
                    {!a.risks.some((r) => r.id === h.id) && " · resolved"}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
