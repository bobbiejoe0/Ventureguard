/** Round to 2 decimals without binary float drift (e.g. 1.005 -> 1.01). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Division that returns `fallback` instead of Infinity/NaN. */
export function safeDivide(a: number, b: number, fallback = 0): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return a / b;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerce user input to a finite number; throws on invalid input. */
export function requireFinite(value: unknown, name: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`${name} must be a finite number`);
  }
  return n;
}

export function requireNonNegative(value: unknown, name: string): number {
  const n = requireFinite(value, name);
  if (n < 0) throw new Error(`${name} cannot be negative`);
  return n;
}

const SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", KES: "KSh ", GHS: "GH₵", ZAR: "R ", INR: "₹" };

/** Thousands separators without Intl, so server and browser output match exactly (no hydration drift). */
function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatMoney(value: number, currency = "NGN", compact = false): string {
  const v = Number.isFinite(value) ? value : 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const sym = SYMBOLS[currency] ?? `${currency} `;
  if (!compact) return `${sign}${sym}${group(abs)}`;
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}${sym}${roundTo(abs / size, 1)}${suffix}`;
  }
  return `${sign}${sym}${group(abs)}`;
}

export function formatPct(value: number, decimals = 1): string {
  return `${roundTo(value, decimals)}%`;
}
