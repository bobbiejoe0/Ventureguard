"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Card, cx } from "@/components/ui";
import { emptyBusiness, FinancialSection, GoalsSection, ProfileSection, validateBusiness } from "@/components/BusinessForm";
import { useWorkspace } from "@/lib/store/workspace";
import { novaRetail } from "@/engine/demo";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { Business } from "@/engine/types";

const STEPS = ["Business profile", "Financial profile", "Goals"];

export default function Onboarding() {
  const ws = useWorkspace();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [b, setB] = useState<Business>(() => emptyBusiness("local"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Without Firebase, onboarding creates a local workspace; with Firebase, sign in first.
    if (ws.ready && ws.mode === "none" && isFirebaseConfigured) router.replace("/login");
  }, [ws.ready, ws.mode, router]);

  const finish = async (biz: Business) => {
    const err = validateBusiness(biz);
    if (err) {
      setError(err);
      return;
    }
    const month = new Date().toISOString().slice(0, 7);
    const withHistory: Business = biz.history.length
      ? biz
      : {
          ...biz,
          history: [
            {
              month,
              revenue: biz.monthlyRevenue,
              variableCosts: biz.monthlyVariableCosts,
              fixedCosts: biz.monthlyFixedCosts,
              debtRepayment: biz.monthlyDebtRepayment,
              closingCash: biz.cashBalance,
            },
          ],
        };
    await ws.saveBusiness(withHistory);
    router.replace("/app");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Tell us about your business</h1>
        <p className="mt-1 text-sm text-muted">This is your Business DNA. VentureGuard uses it for every calculation. You can edit it any time in Settings.</p>

        <div className="mt-6 flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cx("h-1.5 rounded-full", i <= step ? "bg-navy-900" : "bg-line")} />
              <div className={cx("mt-1.5 text-[12px]", i === step ? "font-semibold text-navy-900" : "text-muted")}>{s}</div>
            </div>
          ))}
        </div>

        <Card className="mt-6 p-6">
          {step === 0 && <ProfileSection b={b} set={setB} />}
          {step === 1 && <FinancialSection b={b} set={setB} />}
          {step === 2 && (
            <>
              <p className="mb-3 text-sm text-muted">What matters most right now? Pick any.</p>
              <GoalsSection b={b} set={setB} />
            </>
          )}
          {error && <p className="mt-4 text-[13px] text-bad">{error}</p>}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < 2 ? (
              <Button
                onClick={() => {
                  setError(null);
                  if (step === 0 && !b.name.trim()) return setError("Please enter your business name.");
                  setStep(step + 1);
                }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="accent" onClick={() => finish(b)}>
                <Check className="h-4 w-4" /> Finish setup
              </Button>
            )}
          </div>
        </Card>

        <button
          onClick={() => finish(novaRetail(ws.user?.uid ?? "demo"))}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-[13px] text-navy-700 hover:border-navy-600"
        >
          <Sparkles className="h-4 w-4" /> Skip and load the fictional Nova Retail sample data
        </button>
      </div>
    </div>
  );
}
