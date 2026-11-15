"use client";

import { useMemo } from "react";
import { summarize } from "@/engine/calculations";
import { computeHealthScore } from "@/engine/healthScore";
import { detectRisks } from "@/engine/risks";
import { useWorkspace } from "./workspace";

/** Deterministic analysis of the current business. Recomputed only when inputs change. */
export function useAnalysis() {
  const { business, policies } = useWorkspace();
  return useMemo(() => {
    if (!business) return null;
    const summary = summarize(business);
    return {
      business,
      policies,
      summary,
      health: computeHealthScore(business, summary),
      risks: detectRisks(business, policies, summary),
    };
  }, [business, policies]);
}
