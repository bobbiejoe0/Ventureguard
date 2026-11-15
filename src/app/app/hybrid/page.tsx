"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, Cpu, Download, Layers, XCircle } from "lucide-react";
import { Button, Card, CardHeader, cx, PageHeader, SourceBadge } from "@/components/ui";
import { aiConfigured, generate, getDeviceAvailability, initializeDeviceModel, type AiRoute, type DeviceAvailability } from "@/lib/ai/hybrid";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { useWorkspace } from "@/lib/store/workspace";
import { buildContext, quickInsightPrompt } from "@/lib/ai/prompts";

interface LogRow {
  at: string;
  label: string;
  mode: string;
  source: string;
  latencyMs: number | null;
  ok: boolean;
  detail: string;
}

const RUNS: { route: AiRoute; label: string; mode: string; icon: typeof Cpu; desc: string }[] = [
  { route: "quick", label: "Hybrid", mode: "PREFER_ON_DEVICE", icon: Layers, desc: "What the app uses for quick insights: on-device first, cloud fallback." },
  { route: "device_only", label: "Force on-device", mode: "ONLY_ON_DEVICE", icon: Cpu, desc: "Proves the local Chrome Prompt API path." },
  { route: "cloud_only", label: "Force cloud", mode: "ONLY_IN_CLOUD", icon: Cloud, desc: "Proves the Gemini cloud path." },
];

function chromeVersion(): number | null {
  if (typeof navigator === "undefined") return null;
  const m = navigator.userAgent.match(/Chrome\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <XCircle className={cx("mt-0.5 h-4 w-4 shrink-0", ok === null ? "text-muted" : "text-bad")} />}
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-muted">{detail}</div>
      </div>
    </div>
  );
}

export default function HybridLab() {
  const a = useAnalysis();
  const { online } = useWorkspace();
  const [avail, setAvail] = useState<DeviceAvailability | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [initState, setInitState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [initError, setInitError] = useState("");
  const [busy, setBusy] = useState<AiRoute | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const chrome = chromeVersion();

  useEffect(() => {
    getDeviceAvailability().then(setAvail);
  }, []);

  if (!a) return null;
  const ctx = buildContext(a.business, a.summary, a.health, a.risks);
  const prompt = quickInsightPrompt(ctx, "In two sentences, what is the single most important thing about this business's finances right now?");

  const init = async () => {
    setInitState("running");
    setInitError("");
    try {
      await initializeDeviceModel((p) => setProgress(p));
      setInitState("done");
    } catch (e) {
      setInitState("error");
      setInitError(e instanceof Error ? e.message : String(e));
    }
    setAvail(await getDeviceAvailability());
  };

  const run = async (r: (typeof RUNS)[number]) => {
    setBusy(r.route);
    const at = new Date().toLocaleTimeString();
    try {
      const res = await generate(prompt, r.route);
      setLog((l) => [{ at, label: r.label, mode: r.mode, source: res.inferenceSource, latencyMs: res.latencyMs, ok: true, detail: res.text.slice(0, 180) }, ...l]);
    } catch (e) {
      setLog((l) => [{ at, label: r.label, mode: r.mode, source: "error", latencyMs: null, ok: false, detail: e instanceof Error ? e.message : String(e) }, ...l]);
    } finally {
      setBusy(null);
    }
  };

  const availText: Record<DeviceAvailability, string> = {
    unsupported: "This browser has no Chrome Prompt API (LanguageModel). Use desktop Chrome 139+.",
    unavailable: "The Prompt API exists but this device can't run the model (hardware, disk space, or flags).",
    downloadable: "Supported. Click 'Prepare on-device model' to download Gemini Nano.",
    downloading: "Gemini Nano is downloading…",
    available: "Gemini Nano is ready on this device.",
  };

  return (
    <>
      <PageHeader
        title="Hybrid AI Lab"
        subtitle="Live proof of Firebase AI Logic hybrid inference. Each run shows the inference source exactly as reported by the SDK in result.response.inferenceSource. Nothing here is simulated."
      />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Environment" />
            <div className="divide-y divide-line px-5 pb-3">
              <Check ok={aiConfigured()} label="Firebase AI Logic configured" detail={aiConfigured() ? "firebase/ai SDK initialised with your project" : "Add Firebase values to .env.local"} />
              <Check ok={chrome !== null ? chrome >= 139 : false} label={`Chrome ${chrome ?? "not detected"}`} detail="On-device web inference needs desktop Chrome 139+" />
              <Check ok={avail === null ? null : avail === "available"} label={`On-device model: ${avail ?? "checking…"}`} detail={avail ? availText[avail] : ""} />
              <Check ok={online} label={online ? "Online" : "Offline"} detail={online ? "Cloud fallback available" : "Only on-device inference can run"} />
              <Check ok={Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) || process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "true"} label="App Check" detail={process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "true" ? "Debug provider (local development)" : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? "reCAPTCHA provider configured" : "Not configured"} />
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold">Prepare on-device model</h3>
            <p className="mt-1 text-[13px] text-muted">Calls <code className="font-mono text-[12px]">model.initializeDeviceModel()</code>. It must run after a click, as the Prompt API requires.</p>
            <Button className="mt-3 w-full" variant="secondary" onClick={init} loading={initState === "running"}>
              <Download className="h-4 w-4" /> Prepare on-device model
            </Button>
            {progress !== null && initState === "running" && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-50">
                <div className="h-full bg-good transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
            {initState === "done" && <p className="mt-2 text-[12px] text-good">Device model initialised.</p>}
            {initState === "error" && <p className="mt-2 text-[12px] text-bad">{initError}</p>}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {RUNS.map((r) => (
              <Card key={r.route} className="flex flex-col p-5">
                <r.icon className="h-5 w-5 text-navy-700" />
                <div className="mt-2 font-semibold">{r.label}</div>
                <code className="mt-0.5 font-mono text-[11px] text-navy-600">InferenceMode.{r.mode}</code>
                <p className="mt-2 flex-1 text-[12px] text-muted">{r.desc}</p>
                <Button className="mt-3" size="sm" onClick={() => run(r)} loading={busy === r.route} disabled={busy !== null && busy !== r.route}>
                  Run test
                </Button>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Inference log" subtitle="Values come straight from result.response.inferenceSource" />
            <div className="overflow-x-auto px-5 pb-4">
              {log.length === 0 ? (
                <p className="py-4 text-[13px] text-muted">No runs yet. Try "Force on-device", then "Force cloud".</p>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Reported source</th>
                      <th className="py-2 pr-3">Latency</th>
                      <th className="py-2">Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {log.map((l, i) => (
                      <tr key={i} className="align-top">
                        <td className="num py-2.5 pr-3 text-muted">{l.at}</td>
                        <td className="py-2.5 pr-3 font-mono text-[11px]">{l.mode}</td>
                        <td className="py-2.5 pr-3">{l.ok ? <SourceBadge source={l.source} /> : <span className="text-[12px] font-semibold text-bad">ERROR</span>}</td>
                        <td className="num py-2.5 pr-3">{l.latencyMs !== null ? `${(l.latencyMs / 1000).toFixed(2)}s` : "—"}</td>
                        <td className={cx("py-2.5 text-[12px]", l.ok ? "text-navy-800" : "text-bad")}>{l.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold">How it's wired</h3>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-navy-950 p-4 font-mono text-[12px] leading-relaxed text-navy-100">{`const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: { model: "${process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-3.5-flash-lite"}" },
});
await model.initializeDeviceModel(onProgress); // after a click
const result = await model.generateContent(prompt);
result.response.inferenceSource; // "on_device" | "in_cloud"`}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}
