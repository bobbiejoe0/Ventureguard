"use client";

import { useCallback, useState } from "react";
import { aiConfigured, generate, getDeviceAvailability, type AiResult, type AiRoute } from "./hybrid";
import { validateFigures, type ValidationReport } from "./prompts";
import { newId, useWorkspace } from "@/lib/store/workspace";

export interface AiRun extends AiResult {
  question: string;
  validation: ValidationReport;
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/app.?check/i.test(msg)) return "Firebase App Check rejected the request. Register your debug token (see README) or check your reCAPTCHA key.";
  if (/api.?key|permission|403/i.test(msg)) return "Firebase AI Logic is not enabled for this project, or the API key is restricted. See README → Firebase setup.";
  if (/on.?device|not available|unavailable/i.test(msg)) return "The on-device model is not available in this browser. Use Chrome 139+ on desktop, or try the cloud route.";
  if (/network|fetch|offline/i.test(msg)) return "You're offline and the on-device model isn't available. Calculations still work. Try again when you're back online.";
  return msg;
}

export function useAi() {
  const { saveInsight, online } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiRun | null>(null);

  const run = useCallback(
    async (opts: { prompt: string; question: string; route?: AiRoute; context: Record<string, unknown>; save?: boolean }) => {
      const route = opts.route ?? "quick";
      setError(null);
      if (!aiConfigured()) {
        setError("AI is not configured yet. Add your Firebase project values to .env.local (see README). All calculations work without it.");
        return null;
      }
      // Offline: only the on-device path can work. Don't fire a cloud request we know will fail.
      if (!online) {
        const avail = await getDeviceAvailability();
        if (route === "detailed" || route === "cloud_only" || avail !== "available") {
          setError("You're offline. Cloud analysis will be available when you reconnect. Your numbers and simulations still work offline.");
          return null;
        }
      }
      setLoading(true);
      try {
        const r = await generate(opts.prompt, route);
        const run: AiRun = { ...r, question: opts.question, validation: validateFigures(r.text, opts.context) };
        setResult(run);
        if (opts.save !== false) {
          void saveInsight({
            id: newId(),
            question: opts.question,
            text: r.text,
            inferenceSource: r.inferenceSource,
            route: r.route,
            model: r.model,
            latencyMs: r.latencyMs,
            unverified: run.validation.unverified,
            createdAt: new Date().toISOString(),
          });
        }
        return run;
      } catch (e) {
        console.error("[VentureGuard] AI request failed", e);
        setError(friendlyError(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [online, saveInsight],
  );

  return { run, loading, error, result, setResult };
}
