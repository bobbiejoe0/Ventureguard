import { cx } from "./ui";

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", light ? "text-white" : "text-navy-900", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <path d="M16 2.5 4.5 7v8.2c0 7.1 4.8 12.6 11.5 14.3 6.7-1.7 11.5-7.2 11.5-14.3V7L16 2.5Z" fill={light ? "#fff" : "#142B4A"} />
        <path d="M9.5 18.5l4-4 3 3 6-6.5" fill="none" stroke="#16A36A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px]">VentureGuard</span>
    </span>
  );
}
