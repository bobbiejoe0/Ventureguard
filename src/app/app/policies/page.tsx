"use client";

import { useState } from "react";
import { CheckCircle2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, cx, Field, inputClass, NumberInput, PageHeader, SeverityBadge } from "@/components/ui";
import { useAnalysis } from "@/lib/store/useAnalysis";
import { newId, useWorkspace } from "@/lib/store/workspace";
import { evaluatePolicies, POLICY_LABELS } from "@/engine/policies";
import type { BusinessPolicy, PolicyType } from "@/engine/types";
import { formatMoney } from "@/engine/money";

function describe(type: PolicyType, threshold: number, currency: string) {
  switch (type) {
    case "minimum_cash_reserve":
      return `Keep at least ${threshold} months of essential expenses in reserve`;
    case "maximum_debt_service":
      return `Debt repayments must not exceed ${threshold}% of monthly revenue`;
    case "minimum_margin":
      return `Maintain a gross profit margin of at least ${threshold}%`;
    case "spending_limit":
      return `Review any single outlay above ${formatMoney(threshold, currency)}`;
  }
}

export default function PolicyGuardPage() {
  const a = useAnalysis();
  const { policies, savePolicies } = useWorkspace();
  const [newType, setNewType] = useState<PolicyType>("spending_limit");
  const [newThreshold, setNewThreshold] = useState(1_000_000);
  if (!a) return null;
  const { business: b, summary: s } = a;

  const checks = evaluatePolicies(policies, {
    cash: s.cash,
    essentialMonthly: s.essentialMonthly,
    revenue: s.revenue,
    variableCosts: s.variableCosts,
    debtRepayment: s.debtRepayment,
    largestOutlay: 0,
    context: "today",
  });
  const update = (id: string, patch: Partial<BusinessPolicy>) =>
    savePolicies(
      policies.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        return { ...next, description: describe(next.type, next.threshold, b.currency) };
      }),
    );

  return (
    <>
      <PageHeader
        title="PolicyGuard"
        subtitle="Set the rules that protect your business. Every proposed decision in the Decision Lab is checked against them. PolicyGuard warns and explains; it never blocks you."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {policies.map((p, i) => {
            const c = checks.find((x) => x.policy.id === p.id);
            const meta = POLICY_LABELS[p.type];
            return (
              <Card key={p.id} className={cx("fade-up p-5 transition-opacity", !p.enabled && "opacity-60")} style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wide text-muted">{meta.name}</div>
                    <div className="mt-0.5 font-semibold">{p.description}</div>
                    <div className="mt-0.5 text-[12px] text-muted">{meta.hint}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                      <input type="checkbox" checked={p.enabled} onChange={(e) => update(p.id, { enabled: e.target.checked })} className="h-4 w-4 accent-navy-900" />
                      Enabled
                    </label>
                    <button onClick={() => savePolicies(policies.filter((x) => x.id !== p.id))} className="text-muted hover:text-bad" aria-label="Delete policy">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <div className="w-48">
                    <Field label={`Threshold (${meta.unit})`}>
                      <NumberInput value={p.threshold} prefix={p.type === "spending_limit" ? "₦" : undefined} step={p.type === "spending_limit" ? 100_000 : 1} onChange={(n) => update(p.id, { threshold: n })} />
                    </Field>
                  </div>
                  {p.enabled && c && (
                    <div className={cx("flex-1 rounded-xl px-3 py-2 text-[13px]", c.passed ? "bg-good-soft" : "bg-bad-soft")}>
                      <div className="flex items-center gap-2 font-medium">
                        {c.passed ? <CheckCircle2 className="h-4 w-4 text-good" /> : <ShieldAlert className="h-4 w-4 text-bad" />}
                        {p.type === "spending_limit" ? "Checked when you simulate a decision" : c.passed ? "Your business currently meets this policy" : "Currently breached"}
                        {c.violation && <SeverityBadge severity={c.violation.severity} />}
                      </div>
                      {p.type !== "spending_limit" && <div className="num mt-0.5 text-[12px] text-navy-800">{c.detail}</div>}
                      {c.violation && <div className="mt-1 text-[12px] text-navy-800">Suggested change: {c.violation.alternative}</div>}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit">
          <CardHeader title="Add a policy" />
          <div className="space-y-4 p-5 pt-3">
            <Field label="Policy type">
              <select className={inputClass} value={newType} onChange={(e) => setNewType(e.target.value as PolicyType)}>
                {(Object.keys(POLICY_LABELS) as PolicyType[]).map((t) => (
                  <option key={t} value={t}>
                    {POLICY_LABELS[t].name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Threshold (${POLICY_LABELS[newType].unit})`} help={POLICY_LABELS[newType].hint}>
              <NumberInput value={newThreshold} onChange={setNewThreshold} />
            </Field>
            <Button
              className="w-full"
              onClick={() =>
                savePolicies([...policies, { id: newId(), type: newType, threshold: newThreshold, enabled: true, description: describe(newType, newThreshold, b.currency) }])
              }
            >
              <Plus className="h-4 w-4" /> Add policy
            </Button>
            <p className="text-[12px] text-muted">
              Essential expenses = fixed costs + debt repayments ({formatMoney(s.essentialMonthly, b.currency)} / month for {b.name}).
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
