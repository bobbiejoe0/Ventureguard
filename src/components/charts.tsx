"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/engine/money";
import type { MonthlySnapshot } from "@/engine/types";
import type { ScenarioResult } from "@/engine/scenarios";

// Validated categorical slots (fixed order) + neutral baseline. Status colors are not reused for series.
export const SERIES = { s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", neutral: "#8a94a3" };
const GRID = "#e9edf2";
const AXIS = { fontSize: 12, fill: "#5b6b80" };

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleString("en", { month: "short" });
};

function MoneyTooltip({ active, payload, label, currency, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number; currency: string; labelFmt?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 font-semibold text-navy-900">{labelFmt ? labelFmt(label ?? "") : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num font-medium text-navy-900">{formatMoney(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

const compact = (currency: string) => (v: number) => formatMoney(v, currency, true);

export function RevenueExpenseChart({ history, currency }: { history: MonthlySnapshot[]; currency: string }) {
  const data = history.map((h) => ({
    month: monthLabel(h.month),
    Revenue: h.revenue,
    Expenses: h.variableCosts + h.fixedCosts + h.debtRepayment,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact(currency)} width={64} />
        <Tooltip cursor={{ fill: "rgba(36,75,115,0.06)" }} content={<MoneyTooltip currency={currency} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#5b6b80" }} />
        <Bar animationDuration={500} dataKey="Revenue" fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar animationDuration={500} dataKey="Expenses" fill={SERIES.s2} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProfitTrendChart({ history, currency }: { history: MonthlySnapshot[]; currency: string }) {
  const data = history.map((h) => ({
    month: monthLabel(h.month),
    "Net operating profit": h.revenue - h.variableCosts - h.fixedCosts - h.debtRepayment,
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact(currency)} width={64} domain={["auto", "auto"]} />
        <Tooltip content={<MoneyTooltip currency={currency} />} />
        <ReferenceLine y={0} stroke="#c3cad4" />
        <Line animationDuration={500} type="monotone" dataKey="Net operating profit" stroke={SERIES.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: SERIES.s1 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CashTrendChart({ history, currency }: { history: MonthlySnapshot[]; currency: string }) {
  const data = history.map((h) => ({ month: monthLabel(h.month), "Closing cash": h.closingCash }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.s1} stopOpacity={0.22} />
            <stop offset="100%" stopColor={SERIES.s1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact(currency)} width={64} />
        <Tooltip content={<MoneyTooltip currency={currency} />} />
        <Area animationDuration={500} type="monotone" dataKey="Closing cash" stroke={SERIES.s1} strokeWidth={2} fill="url(#cashFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Projected cash per scenario vs not taking the decision, with the required reserve as a reference line. */
export function ScenarioCashChart({
  scenarios,
  currency,
  reserve,
  startCash,
}: {
  scenarios: Record<"optimistic" | "expected" | "pessimistic", ScenarioResult>;
  currency: string;
  reserve: number | null;
  startCash: number;
}) {
  const e = scenarios.expected.months;
  const data = [
    { month: 0, Expected: startCash, Optimistic: startCash, Pessimistic: startCash, "No decision": startCash },
    ...e.map((m, i) => ({
      month: m.month,
      Expected: m.cash,
      Optimistic: scenarios.optimistic.months[i].cash,
      Pessimistic: scenarios.pessimistic.months[i].cash,
      "No decision": m.baselineCash,
    })),
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 16 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(m) => (m === 0 ? "Now" : `M${m}`)} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact(currency)} width={64} domain={["auto", "auto"]} />
        <Tooltip content={<MoneyTooltip currency={currency} labelFmt={(l) => (l === 0 ? "Today" : `Month ${l}`)} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#5b6b80" }} />
        {reserve !== null && reserve > 0 && (
          <ReferenceLine
            y={reserve}
            ifOverflow="extendDomain"
            stroke="#d94a4a"
            strokeDasharray="5 4"
            label={{ value: `Required reserve ${formatMoney(reserve, currency, true)}`, position: "insideTopLeft", fontSize: 11, fill: "#b23b3b" }}
          />
        )}
        <Line animationDuration={500} type="monotone" dataKey="No decision" stroke={SERIES.neutral} strokeWidth={2} strokeDasharray="4 4" dot={false} />
        <Line animationDuration={500} type="monotone" dataKey="Optimistic" stroke={SERIES.s3} strokeWidth={2} dot={false} />
        <Line animationDuration={500} type="monotone" dataKey="Expected" stroke={SERIES.s1} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        <Line animationDuration={500} type="monotone" dataKey="Pessimistic" stroke={SERIES.s2} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
