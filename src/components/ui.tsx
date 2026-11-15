"use client";

import Link from "next/link";
import { Cloud, Cpu, HelpCircle, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Severity } from "@/engine/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(20,43,74,0.04),0_4px_16px_rgba(20,43,74,0.04)]", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-2.5">
        {icon && <div className="mt-0.5 text-navy-700">{icon}</div>}
        <div>
          <h3 className="text-[15px] font-semibold text-navy-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const variants: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 disabled:bg-navy-900/50",
  accent: "bg-good text-white hover:bg-[#12895a] disabled:opacity-50",
  secondary: "border border-line bg-white text-navy-900 hover:bg-navy-50 disabled:opacity-50",
  ghost: "text-navy-700 hover:bg-navy-50 disabled:opacity-50",
  danger: "border border-bad/30 bg-white text-bad hover:bg-bad-soft",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[0.97] disabled:cursor-not-allowed", sizes[size], variants[variant], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", className, size = "md" }: { href: string; children: ReactNode; variant?: Variant; className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.97]", sizes[size], variants[variant], className)}>
      {children}
    </Link>
  );
}

const sevStyles: Record<Severity, string> = {
  critical: "bg-bad text-white",
  high: "bg-bad-soft text-bad",
  medium: "bg-warn-soft text-[#a86b12]",
  low: "bg-navy-50 text-navy-700",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", sevStyles[severity])}>{severity}</span>;
}

export function Pill({ tone = "neutral", children }: { tone?: "good" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  const t = { good: "bg-good-soft text-good", warn: "bg-warn-soft text-[#a86b12]", bad: "bg-bad-soft text-bad", neutral: "bg-navy-50 text-navy-700" }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-[#a86b12]" : "text-navy-900";
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("num mt-1 text-[22px] font-semibold leading-tight", color)}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  if (source === "on_device")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 text-[11px] font-semibold text-good">
        <Cpu className="h-3.5 w-3.5" /> ON_DEVICE
      </span>
    );
  if (source === "in_cloud")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-100 px-2.5 py-1 text-[11px] font-semibold text-navy-700">
        <Cloud className="h-3.5 w-3.5" /> IN_CLOUD
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-[#a86b12]">
      <HelpCircle className="h-3.5 w-3.5" /> SOURCE NOT REPORTED
    </span>
  );
}

export function Field({
  label,
  help,
  children,
  badge,
  group,
}: {
  label: string;
  help?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
  /** Render as a div with role=group for button groups (a label would forward clicks to the first button). */
  group?: boolean;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="flex items-center gap-2 text-[13px] font-medium text-navy-900">
        {label}
        {badge}
      </span>
      <div className="mt-1.5">{children}</div>
      {help && <span className="mt-1 block text-[12px] text-muted">{help}</span>}
    </Tag>
  );
}

export const inputClass =
  "num h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-navy-900 outline-none transition placeholder:text-muted/60 focus:border-navy-600 focus:ring-4 focus:ring-navy-100";

export function NumberInput({ value, onChange, prefix, suffix, min = 0, step }: { value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; min?: number; step?: number }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        className={cx(inputClass, prefix && "pl-8", suffix && "pr-14")}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Tiny markdown renderer for AI output: headings, bullets, numbered lists, bold. Escapes HTML first. */
export function Markdown({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>");
  const lines = text.replace(/\r/g, "").split("\n");
  let html = "";
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,3}\s+(.*)/))) {
      close();
      html += `<h2>${inline(m[1])}</h2>`;
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== "ul") {
        close();
        html += "<ul>";
        list = "ul";
      }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== "ol") {
        close();
        html += "<ol>";
        list = "ol";
      }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^([A-Z][A-Za-z ]{2,30}):\s*(.*)$/))) {
      close();
      html += `<h3>${esc(m[1])}</h3>${m[2] ? `<p>${inline(m[2])}</p>` : ""}`;
    } else if (line.trim() === "") {
      close();
    } else {
      close();
      html += `<p>${inline(line)}</p>`;
    }
  }
  close();
  return <div className="prose-vg text-[14px] text-navy-900" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center">
      <div className="font-medium text-navy-900">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
