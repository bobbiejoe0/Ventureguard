"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Cloud,
  Cpu,
  FlaskConical,
  Gauge,
  LifeBuoy,
  Lock,
  Radar,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, cx } from "@/components/ui";
import { CountUp, Reveal } from "@/components/Reveal";
import { useWorkspace } from "@/lib/store/workspace";
import { NOVA_BRANCH_INPUTS, novaRetail } from "@/engine/demo";
import { simulateDecision } from "@/engine/scenarios";
import { DEFAULT_POLICIES } from "@/engine/policies";
import { computeHealthScore } from "@/engine/healthScore";
import { formatMoney } from "@/engine/money";

// Every figure on this page is computed by the real engine from the fictional Nova Retail data.
const nova = novaRetail();
const health = computeHealthScore(nova);
const heroSim = simulateDecision(nova, "open_branch", NOVA_BRANCH_INPUTS, DEFAULT_POLICIES).scenarios;
const heroViolation = heroSim.expected.policyChecks.find((c) => !c.passed && c.policy.type === "minimum_cash_reserve")?.violation;
const waited = simulateDecision(nova, "open_branch", NOVA_BRANCH_INPUTS, DEFAULT_POLICIES, { startDelayMonths: 3 }).scenarios.expected;

const FEATURES = [
  { icon: Gauge, title: "Business Health Score", text: "A 0–100 score across six dimensions with transparent formulas. Click any score to see exactly why." },
  { icon: FlaskConical, title: "Decision Lab", text: "Simulate a branch, a hire, a loan or a price change across optimistic, expected and pessimistic scenarios." },
  { icon: ShieldCheck, title: "PolicyGuard", text: "Set rules like \"keep 3 months of reserves\". Every decision is checked, with the size of any breach and a safer alternative." },
  { icon: Radar, title: "Risk Radar", text: "Rule-based early warnings with evidence, consequences and recommended actions. No AI guesswork." },
  { icon: BrainCircuit, title: "AI Business Advisor", text: "Ask why cash keeps disappearing. The answer is grounded in your calculated figures, and every number is checked." },
  { icon: LifeBuoy, title: "Recovery Mode", text: "A practical 30-day plan with priorities and estimated cash impact when things get tight." },
];

const TOUR = [
  {
    img: "/screens/scenario-chart.png",
    w: 1080,
    h: 585,
    tag: "Decision Lab",
    title: "See every month before you spend a naira",
    text: "Three scenarios, projected month by month against what happens if you do nothing. The red line is your own reserve policy. You can see exactly when you'd dip below it.",
    points: ["8 decision types", "Labelled default assumptions", "Instant recalculation"],
  },
  {
    img: "/screens/policyguard.png",
    w: 1080,
    h: 1032,
    tag: "PolicyGuard",
    title: "Your rules, checked automatically",
    text: "PolicyGuard shows which rule a decision breaks, by exactly how much, why it matters and a lower-risk alternative. It warns; you decide.",
    points: ["Reserve, debt, margin and spending rules", "Severity from explicit thresholds", "Never blocks the owner"],
  },
  {
    img: "/screens/hybrid-lab.png",
    w: 2160,
    h: 1350,
    tag: "Hybrid AI",
    title: "On-device first. Cloud when it counts.",
    text: "Quick insights run on Chrome's built-in Gemini Nano through Firebase AI Logic. Deeper analysis goes to Gemini in the cloud. Every answer shows where it actually ran.",
    points: ["PREFER_ON_DEVICE inference", "Real inferenceSource on every answer", "Figure check on every response"],
  },
  {
    img: "/screens/risk-radar.png",
    w: 2160,
    h: 1350,
    tag: "Risk Radar",
    title: "Early warnings with evidence",
    text: "Expenses outpacing revenue, thin reserves, margin decline, debt pressure. Each risk comes with the figures that triggered it and what to do next.",
    points: ["Critical / High / Medium / Low", "Evidence and consequences", "Risk history"],
  },
];

function BrowserFrame({ src, w, h, alt, className, priority }: { src: string; w: number; h: number; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cx("overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl shadow-black/40", className)}>
      <div className="flex items-center gap-1.5 border-b border-line bg-[#f3f5f8] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 hidden flex-1 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-muted sm:block">ventureguard.app/app</span>
      </div>
      <Image src={src} width={w} height={h} alt={alt} priority={priority} className="block h-auto w-full" sizes="(min-width: 1024px) 640px, 100vw" />
    </div>
  );
}

export default function Landing() {
  const ws = useWorkspace();
  const router = useRouter();
  const demo = () => {
    ws.startDemo();
    router.push("/app");
  };
  const hasWorkspace = ws.ready && ws.mode !== "none" && ws.business;

  return (
    <div className="overflow-x-hidden bg-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-900/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo light />
          <nav className="hidden items-center gap-7 text-[14px] text-white/75 md:flex">
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#tour" className="transition-colors hover:text-white">Product</a>
            <a href="#hybrid" className="transition-colors hover:text-white">Hybrid AI</a>
          </nav>
          <div className="flex items-center gap-2">
            {hasWorkspace ? (
              <Link href="/app" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-50">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-medium text-white/85 hover:text-white sm:block">
                  Log in
                </Link>
                <Link href="/login?mode=register" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-navy-900 transition hover:bg-navy-50">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        {/* Hero background: a real photo at public/hero/hero.jpg sits on top; if it's missing,
            the original skyline illustration (public/hero-bg.svg) shows instead. */}
        <div
          className="hero-bg pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/hero/hero.jpg), url(/hero-bg.svg)" }}
        />
        {/* Navy overlay keeps the headline readable over any photo */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,26,46,0.96)_0%,rgba(11,26,46,0.88)_38%,rgba(20,43,74,0.55)_70%,rgba(20,43,74,0.35)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy-900 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
        <div className="glow pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(22,163,106,0.35),transparent_65%)]" />
        <div className="glow pointer-events-none absolute -bottom-60 -left-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(42,120,214,0.35),transparent_65%)] [animation-delay:-3s]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-32 lg:pt-24">
          <div>
            <span className="fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-navy-100">
              <span className="ping relative inline-flex h-2 w-2 rounded-full bg-good text-good" />
              Hybrid on-device + cloud AI, powered by Firebase AI Logic
            </span>
            <h1 className="fade-up mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[52px]" style={{ "--d": "80ms" } as React.CSSProperties}>
              Know what a decision will do to your business <span className="bg-gradient-to-r from-[#3ddc97] to-good bg-clip-text text-transparent">before</span> you commit.
            </h1>
            <p className="fade-up mt-5 max-w-xl text-lg text-navy-100/80" style={{ "--d": "160ms" } as React.CSSProperties}>
              VentureGuard simulates your next move, checks it against the rules that protect your business, and explains the consequences in plain language.
            </p>
            <div className="fade-up mt-8 flex flex-wrap gap-3" style={{ "--d": "240ms" } as React.CSSProperties}>
              <Button variant="accent" size="lg" onClick={demo} className="shine shadow-lg shadow-good/25">
                Try the live demo <ArrowRight className="h-4 w-4" />
              </Button>
              <Link href="/login?mode=register" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 text-[15px] font-medium text-white transition hover:bg-white/5">
                Create a free account
              </Link>
            </div>
            <ul className="fade-up mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-navy-100/70" style={{ "--d": "320ms" } as React.CSSProperties}>
              {["No sign-up for the demo", "Works offline", "Fictional demo data"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-good" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Layered product visual: real screenshot + live engine cards */}
          <div className="relative mx-auto w-full max-w-[620px] lg:mr-[-40px]">
            <div className="scale-in" style={{ "--d": "200ms" } as React.CSSProperties}>
              <div className="lg:tilt">
                <BrowserFrame src="/screens/dashboard.png" w={2160} h={1350} alt="VentureGuard dashboard showing the business health score and key figures" priority />
              </div>
            </div>

            <div className="scale-in absolute -bottom-14 -left-4 w-[78%] sm:-left-10 sm:w-[340px]" style={{ "--d": "550ms" } as React.CSSProperties}>
              <div className="float rounded-2xl border border-line bg-white p-4 text-navy-900 shadow-2xl shadow-black/30" style={{ "--d": "-1s" } as React.CSSProperties}>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Decision Lab</div>
                  <FlaskConical className="h-4 w-4 text-navy-700" />
                </div>
                <div className="mt-0.5 text-[13px] font-semibold">Second branch · {formatMoney(NOVA_BRANCH_INPUTS.investment, "NGN", true)}</div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  {(["optimistic", "expected", "pessimistic"] as const).map((k) => (
                    <div key={k} className={cx("rounded-lg border px-1 py-2", k === "expected" ? "border-navy-700 bg-navy-50" : "border-line")}>
                      <div className="text-[10px] capitalize text-muted">{k}</div>
                      <div className={cx("num text-[13px] font-semibold", heroSim[k].decisionMonthlyProfit >= 0 ? "text-good" : "text-bad")}>
                        {heroSim[k].decisionMonthlyProfit >= 0 ? "+" : ""}
                        {formatMoney(heroSim[k].decisionMonthlyProfit, "NGN", true)}
                      </div>
                    </div>
                  ))}
                </div>
                {heroViolation && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-bad-soft p-2.5 text-[12px]">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bad" />
                    <span>
                      <b className="text-bad">Reserve policy breached</b> by <span className="num font-semibold">{formatMoney(heroViolation.amount, "NGN")}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="scale-in absolute -right-2 -top-8 sm:-right-6" style={{ "--d": "800ms" } as React.CSSProperties}>
              <div className="float flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-navy-900 shadow-xl shadow-black/25" style={{ "--d": "-3s" } as React.CSSProperties}>
                <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#E3EAF3" strokeWidth="4" />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="#16A36A"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - health.total / 100)}
                    className="ring-draw"
                    style={{ "--ring-c": `${2 * Math.PI * 16}` } as React.CSSProperties}
                  />
                </svg>
                <div>
                  <div className="text-[11px] text-muted">Health score</div>
                  <div className="num text-[15px] font-semibold">
                    {health.total}/100 · <span className="text-good">{health.grade}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="scale-in absolute -bottom-20 -right-6 hidden w-[250px] sm:block" style={{ "--d": "1000ms" } as React.CSSProperties}>
              <div className="float rounded-2xl border border-good/30 bg-white px-4 py-3 text-navy-900 shadow-xl shadow-black/25" style={{ "--d": "-4.5s" } as React.CSSProperties}>
                <div className="text-[11px] font-semibold text-good">Safer alternative</div>
                <div className="text-[13px]">
                  Wait 3 months → cash after investment <b className="num">{formatMoney(waited.cashAfterInvestment, "NGN", true)}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- STATS ---------- */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 text-center sm:px-6 md:grid-cols-4">
          {[
            { n: 8, s: "", label: "decision types you can simulate" },
            { n: 3, s: "", label: "scenarios for every decision" },
            { n: 28, s: "", label: "automated tests on the engine" },
            { n: 0, s: "", label: "financial figures invented by AI" },
          ].map((x, i) => (
            <Reveal key={x.label} delay={i * 100}>
              <div className="text-4xl font-semibold tracking-tight text-navy-900">
                <CountUp to={x.n} suffix={x.s} />
              </div>
              <div className="mt-1 text-[13px] text-muted">{x.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- HOW ---------- */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-widest text-good">How it works</p>
          <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">From &quot;should I?&quot; to a clear answer in minutes</h2>
        </Reveal>
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-[42px] hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" />
          {[
            ["1", "Describe your business", "Enter revenue, costs, cash and debt once. VentureGuard builds your Business DNA and Health Score."],
            ["2", "Simulate the decision", "Model the investment across three scenarios, month by month, against your own business policies."],
            ["3", "Understand, then decide", "See the risks, the policy breaches and a safer alternative. AI explains the results; you stay in control."],
          ].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 140}>
              <div className="lift relative h-full rounded-2xl border border-line bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-[15px] font-semibold text-white ring-8 ring-white">{n}</div>
                <h3 className="mt-5 font-semibold">{t}</h3>
                <p className="mt-2 text-[14px] text-muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- PRODUCT TOUR ---------- */}
      <section id="tour" className="scroll-mt-20 bg-canvas py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-center text-[13px] font-semibold uppercase tracking-widest text-good">The product</p>
            <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">Not another dashboard. Not just a chatbot.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Deterministic calculations, scenario simulation, policies and risk rules come first. AI explains them.</p>
          </Reveal>
          <div className="mt-16 space-y-24">
            {TOUR.map((t, i) => (
              <div key={t.tag} className={cx("grid items-center gap-10 lg:grid-cols-2", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                <Reveal from={i % 2 === 0 ? "left" : "right"}>
                  <div className="lift overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-[0_20px_60px_rgba(20,43,74,0.12)]">
                    <Image src={t.img} width={t.w} height={t.h} alt={`${t.tag} screenshot`} className="h-auto w-full rounded-xl" sizes="(min-width: 1024px) 560px, 100vw" />
                  </div>
                </Reveal>
                <Reveal delay={150}>
                  <span className="inline-flex rounded-full bg-navy-50 px-3 py-1 text-[12px] font-semibold text-navy-700">{t.tag}</span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">{t.text}</p>
                  <ul className="mt-5 space-y-2">
                    {t.points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 text-[14px]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-good-soft">
                          <Check className="h-3 w-3 text-good" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Everything an owner needs to decide well</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 110}>
              <div className="lift group h-full rounded-2xl border border-line bg-white p-6 hover:border-navy-600/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 transition-colors group-hover:bg-navy-900">
                  <f.icon className="h-5 w-5 text-navy-700 transition-colors group-hover:text-white" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-[14px] text-muted">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- HYBRID ---------- */}
      <section id="hybrid" className="scroll-mt-20 bg-navy-900 py-24 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal from="left">
            <p className="text-[13px] font-semibold uppercase tracking-widest text-good">Private by design</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Hybrid AI that tells you where it ran</h2>
            <p className="mt-4 text-navy-100/75">
              Quick insights run on Chrome&apos;s built-in Gemini Nano, on your own computer, using Firebase AI Logic&apos;s{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px]">PREFER_ON_DEVICE</code> mode. When the local model isn&apos;t available, or for deeper analysis, requests go to Gemini in the cloud.
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-navy-100/90">
              <li className="flex gap-3"><Lock className="h-5 w-5 shrink-0 text-good" /> Only aggregate figures are sent to a model: no names, emails or transactions.</li>
              <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-good" /> AI never calculates. Every figure in an answer is checked against the engine.</li>
              <li className="flex gap-3"><WifiOff className="h-5 w-5 shrink-0 text-good" /> Calculations, simulations and saved data keep working offline.</li>
            </ul>
          </Reveal>
          <div className="grid gap-4">
            {[
              { icon: Cpu, label: "ON_DEVICE", tone: "bg-good/15 text-good", text: "Metric explanations, risk summaries and quick insights. Fast, private, no network needed." },
              { icon: Cloud, label: "IN_CLOUD", tone: "bg-white/10 text-white", text: "Detailed decision analysis, recovery plans, and automatic fallback when the local model is unavailable." },
            ].map((x, i) => (
              <Reveal key={x.label} from="right" delay={i * 150}>
                <div className="lift flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.08]">
                  <div className={cx("rounded-xl p-3", x.tone)}>
                    <x.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-mono font-semibold">{x.label}</div>
                    <p className="mt-1 text-[14px] text-navy-100/70">{x.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative overflow-hidden py-24 text-center">
        <div className="glow pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(22,163,106,0.14),transparent_65%)]" />
        <Reveal from="zoom" className="relative">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Make smarter decisions. Protect what you&apos;re building.</h2>
          <p className="mt-3 text-muted">Try the full product with fictional Nova Retail data. No account needed.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="accent" size="lg" onClick={demo} className="shine shadow-lg shadow-good/25">
              Try the live demo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Reveal>
      </section>
      <footer className="border-t border-line py-8 text-center text-[13px] text-muted">
        VentureGuard · Built for Google #BuildHybridAI 2026 · Apache 2.0 · Demo data is fictional. Not financial advice.
      </footer>
    </div>
  );
}
