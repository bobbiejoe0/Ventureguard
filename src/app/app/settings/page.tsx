"use client";

import { useState } from "react";
import { CalendarPlus, Save, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { FinancialSection, GoalsSection, ProfileSection, validateBusiness } from "@/components/BusinessForm";
import { useWorkspace } from "@/lib/store/workspace";
import { formatMoney } from "@/engine/money";
import type { Business } from "@/engine/types";

export default function SettingsPage() {
  const ws = useWorkspace();
  const [b, setB] = useState<Business | null>(ws.business);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!b) return null;

  const save = async (next = b) => {
    const err = validateBusiness(next);
    if (err) return setMsg({ ok: false, text: err });
    await ws.saveBusiness(next);
    setMsg({ ok: true, text: ws.online ? "Saved." : "Saved on this device. It will sync when you're back online." });
  };

  const recordMonth = () => {
    const month = new Date().toISOString().slice(0, 7);
    const snap = {
      month,
      revenue: b.monthlyRevenue,
      variableCosts: b.monthlyVariableCosts,
      fixedCosts: b.monthlyFixedCosts,
      debtRepayment: b.monthlyDebtRepayment,
      closingCash: b.cashBalance,
    };
    const next = { ...b, history: [...b.history.filter((h) => h.month !== month), snap].sort((x, y) => x.month.localeCompare(y.month)).slice(-24) };
    setB(next);
    void save(next);
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your Business DNA, monthly history, privacy and AI processing." action={<Button onClick={() => save()}><Save className="h-4 w-4" /> Save changes</Button>} />
      {msg && <p className={`mb-4 text-[13px] ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Business profile" />
            <div className="p-5">
              <ProfileSection b={b} set={setB} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Financial profile" subtitle="Changing these updates every score, risk and simulation instantly" />
            <div className="p-5">
              <FinancialSection b={b} set={setB} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Goals" />
            <div className="p-5">
              <GoalsSection b={b} set={setB} />
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Monthly history"
              subtitle="Trends and trend-based risks use the last 6 months"
              action={
                <Button size="sm" variant="secondary" onClick={recordMonth}>
                  <CalendarPlus className="h-4 w-4" /> Record this month
                </Button>
              }
            />
            <div className="overflow-x-auto p-5 pt-3">
              <table className="w-full text-right text-[13px]">
                <thead className="text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 text-left">Month</th>
                    <th>Revenue</th>
                    <th>Variable</th>
                    <th>Fixed</th>
                    <th>Debt</th>
                    <th>Closing cash</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="num divide-y divide-line">
                  {b.history.map((h) => (
                    <tr key={h.month}>
                      <td className="py-2 text-left font-medium">{h.month}</td>
                      <td>{formatMoney(h.revenue, b.currency, true)}</td>
                      <td>{formatMoney(h.variableCosts, b.currency, true)}</td>
                      <td>{formatMoney(h.fixedCosts, b.currency, true)}</td>
                      <td>{formatMoney(h.debtRepayment, b.currency, true)}</td>
                      <td>{formatMoney(h.closingCash, b.currency, true)}</td>
                      <td className="pl-3">
                        <button className="text-muted hover:text-bad" aria-label="Remove month" onClick={() => setB({ ...b, history: b.history.filter((x) => x.month !== h.month) })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Account & sync" />
            <div className="space-y-2 p-5 pt-3 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Account</span><span>{ws.user?.email ?? "Demo (no account)"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Storage</span><span>{ws.mode === "cloud" ? "Firestore + offline cache" : "This browser only"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Sync status</span><span className="capitalize">{ws.online ? ws.sync : "offline"}</span></div>
              <p className="pt-2 text-[12px] text-muted">
                {ws.mode === "cloud"
                  ? "Changes are written to a local IndexedDB cache first, so everything works offline. Firestore syncs automatically when you reconnect, and the last write wins per document."
                  : "Demo data stays in this browser. Create an account to sync across devices."}
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="AI processing & privacy" />
            <div className="space-y-3 p-5 pt-3 text-[13px] text-navy-800">
              <p><b>Calculations</b> run entirely in your browser in a deterministic engine. AI never produces or overrides a financial figure.</p>
              <p><b>Quick insights</b> use Firebase AI Logic in <code className="font-mono text-[12px]">PREFER_ON_DEVICE</code> mode. When Chrome's built-in Gemini Nano is available, your data never leaves this computer.</p>
              <p><b>Detailed analyses</b> and fallbacks are sent to Gemini in the cloud through Firebase AI Logic, protected by Firebase App Check.</p>
              <p><b>What is sent:</b> aggregate monthly figures and calculated results only. No names, emails or transaction lists. You can inspect the exact payload on the AI Advisor page.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
