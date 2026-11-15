"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Clock3, Cloud, Cpu, Eye, Send } from "lucide-react";
import { Button, Card, CardHeader, cx, inputClass, Markdown, PageHeader, SourceBadge } from "@/components/ui";
import { AiAnswer } from "@/components/AiAnswer";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { useWorkspace } from "@/lib/store/workspace";
import { useAi } from "@/lib/ai/useAi";
import { buildContext, detailedAnalysisPrompt, quickInsightPrompt } from "@/lib/ai/prompts";
import { simulateDecision } from "@/engine/scenarios";
import { formatMoney } from "@/engine/money";

const SUGGESTED = [
  "Why could opening another branch put my existing business at risk?",
  "Why am I making sales but still running out of money?",
  "Can I afford two additional employees?",
  "What should I reduce first?",
  "What happens if sales drop by 20%?",
  "Is my business ready to expand?",
];

const QUEUE_KEY = "ventureguard.aiQueue.v1";

interface Queued {
  question: string;
  route: "quick" | "detailed";
  simId: string;
}

export default function AdvisorPage() {
  const a = useAnalysis();
  const { simulations, insights, online } = useWorkspace();
  const ai = useAi();
  const [question, setQuestion] = useState(SUGGESTED[0]);
  const [route, setRoute] = useState<"quick" | "detailed">("quick");
  const [simId, setSimId] = useState<string>("latest");
  const [showCtx, setShowCtx] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue(JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"));
    } catch {}
  }, []);
  const writeQueue = (q: Queued[]) => {
    setQueue(q);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    } catch {}
  };

  const chosenSim = useMemo(() => {
    if (!a || simId === "none") return null;
    const rec = simId === "latest" ? simulations[0] : simulations.find((s) => s.id === simId);
    if (!rec) return null;
    return { rec, sim: simulateDecision(a.business, rec.decisionType, rec.inputs, a.policies, rec.assumptions) };
  }, [a, simId, simulations]);

  const ctx = useMemo(() => (a ? buildContext(a.business, a.summary, a.health, a.risks, chosenSim?.sim) : {}), [a, chosenSim]);

  const ask = async (q = question, r = route, c = ctx) => {
    const prompt = r === "quick" ? quickInsightPrompt(c, q) : detailedAnalysisPrompt(c, q);
    return ai.run({ prompt, question: q, context: c, route: r });
  };

  // Flush queued questions when connectivity returns.
  useEffect(() => {
    if (!online || queue.length === 0 || ai.loading) return;
    const [next, ...rest] = queue;
    // Responding to an external event (connectivity returned), not deriving state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    writeQueue(rest);
    setQuestion(next.question);
    setRoute(next.route);
    void ask(next.question, next.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (!a) return null;
  const s = a.summary;
  const cur = a.business.currency;

  return (
    <>
      <PageHeader
        title="AI Business Advisor"
        subtitle="Ask a question about your business. VentureGuard sends the model a short summary of your engine-calculated figures, and the model explains them. It never calculates."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className={cx("rounded-full border px-3 py-1.5 text-[12px] transition", question === q ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white hover:border-navy-600")}
                >
                  {q}
                </button>
              ))}
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="mt-4 w-full resize-none rounded-xl border border-line p-3 text-[14px] outline-none focus:border-navy-600 focus:ring-4 focus:ring-navy-100"
              placeholder="Ask about your business…"
            />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="flex rounded-xl border border-line p-1">
                <button
                  onClick={() => setRoute("quick")}
                  className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium", route === "quick" ? "bg-navy-900 text-white" : "text-navy-800")}
                >
                  <Cpu className="h-4 w-4" /> Quick insight
                </button>
                <button
                  onClick={() => setRoute("detailed")}
                  className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium", route === "detailed" ? "bg-navy-900 text-white" : "text-navy-800")}
                >
                  <Cloud className="h-4 w-4" /> Detailed analysis
                </button>
              </div>
              <select className={inputClass} value={simId} onChange={(e) => setSimId(e.target.value)}>
                <option value="latest">{simulations[0] ? `Include decision: ${simulations[0].title} (latest)` : "No saved decision to include"}</option>
                {simulations.slice(1).map((s) => (
                  <option key={s.id} value={s.id}>
                    Include decision: {s.title}
                  </option>
                ))}
                <option value="none">Business data only</option>
              </select>
            </div>
            <p className="mt-2 text-[12px] text-muted">
              {route === "quick"
                ? "Runs on-device with Chrome's built-in Gemini Nano when available (PREFER_ON_DEVICE), and falls back to Gemini in the cloud otherwise."
                : "Uses Gemini in the cloud for a longer, more thorough analysis. Only the summary below is sent."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button loading={ai.loading} onClick={() => ask()} disabled={!question.trim()}>
                <Send className="h-4 w-4" /> Ask VentureGuard
              </Button>
              {!online && (
                <Button variant="secondary" onClick={() => writeQueue([...queue, { question, route, simId }])}>
                  <Clock3 className="h-4 w-4" /> Queue until online
                </Button>
              )}
              <button onClick={() => setShowCtx((v) => !v)} className="flex items-center gap-1.5 text-[13px] text-navy-700 hover:underline">
                <Eye className="h-4 w-4" /> {showCtx ? "Hide" : "Show"} exactly what is sent
              </button>
            </div>
            {queue.length > 0 && <p className="mt-2 text-[12px] text-[#a86b12]">{queue.length} question(s) queued. They'll run automatically when you reconnect.</p>}
            {showCtx && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-navy-950 p-4 text-[11px] leading-relaxed text-navy-100">{JSON.stringify(ctx, null, 2)}</pre>
            )}
          </Card>

          {ai.error && <Card className="border-bad/30 bg-bad-soft p-4 text-[13px] text-bad">{ai.error}</Card>}
          {ai.result && (
            <div>
              <div className="mb-2 text-[13px] font-medium text-muted">{ai.result.question}</div>
              <AiAnswer run={ai.result} />
            </div>
          )}

          {insights.length > 0 && (
            <Card>
              <CardHeader title="Insight history" subtitle="Each answer records the actual inference source reported by Firebase AI Logic" />
              <div className="divide-y divide-line px-5 pb-2">
                {insights.slice(0, 8).map((i) => (
                  <details key={i.id} className="py-3">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                      <SourceBadge source={i.inferenceSource} />
                      <span className="text-[13px] font-medium">{i.question}</span>
                      <span className="ml-auto text-[11px] text-muted">{new Date(i.createdAt).toLocaleString("en-US")}</span>
                    </summary>
                    <div className="mt-3 rounded-xl bg-canvas p-4">
                      <Markdown text={i.text} />
                    </div>
                  </details>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Supporting evidence" subtitle="Calculated by the engine. These are the figures the answer must use." icon={<BrainCircuit className="h-4 w-4" />} />
            <dl className="space-y-2 p-5 pt-3 text-[13px]">
              {[
                ["Monthly revenue", formatMoney(s.revenue, cur)],
                ["Monthly expenses", formatMoney(s.totalExpenses, cur)],
                ["Net operating profit", formatMoney(s.netProfit, cur)],
                ["Cash on hand", formatMoney(s.cash, cur)],
                ["Essential expenses / month", formatMoney(s.essentialMonthly, cur)],
                ["Reserve coverage", `${s.reserveMonths ?? "—"} months`],
                ["Health score", `${a.health.total}/100 (${a.health.grade})`],
                ["Active risks", String(a.risks.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num font-semibold">{v}</dd>
                </div>
              ))}
              {chosenSim && (
                <>
                  <div className="border-t border-line pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{chosenSim.rec.title}</div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Cash after investment</dt>
                    <dd className="num font-semibold">{formatMoney(chosenSim.sim.scenarios.expected.cashAfterInvestment, cur)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Decision profit / month</dt>
                    <dd className="num font-semibold">{formatMoney(chosenSim.sim.scenarios.expected.decisionMonthlyProfit, cur)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Policy violations</dt>
                    <dd className="num font-semibold">{chosenSim.sim.scenarios.expected.policyChecks.filter((c) => !c.passed).length}</dd>
                  </div>
                </>
              )}
            </dl>
          </Card>
          <Card className="p-5 text-[12px] text-muted">
            <div className="mb-1 font-semibold text-navy-900">Privacy</div>
            The model receives aggregate figures only: no names, emails, or transaction details. On-device answers never leave your computer. Cloud answers go through Firebase AI Logic, protected by App Check.
          </Card>
        </div>
      </div>
    </>
  );
}
