"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Markdown, SourceBadge } from "./ui";
import type { AiRun } from "@/lib/ai/useAi";

export function AiAnswer({ run }: { run: AiRun }) {
  const { validation } = run;
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <SourceBadge source={run.inferenceSource} />
        <span className="text-[12px] text-muted">{run.model}</span>
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <Clock className="h-3 w-3" /> {(run.latencyMs / 1000).toFixed(1)}s
        </span>
        <span className="ml-auto">
          {validation.unverified.length === 0 ? (
            <span className="flex items-center gap-1 text-[12px] text-good">
              <CheckCircle2 className="h-3.5 w-3.5" /> {validation.checked > 0 ? `${validation.checked} figures match the engine` : "No new figures introduced"}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[12px] text-[#a86b12]" title={validation.unverified.join(", ")}>
              <AlertTriangle className="h-3.5 w-3.5" /> {validation.unverified.length} figure(s) not from the engine
            </span>
          )}
        </span>
      </div>
      <div className="px-5 py-4">
        <Markdown text={run.text} />
        {validation.unverified.length > 0 && (
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-[#7a4f0e]">
            Treat these as unverified: {validation.unverified.join(", ")}. The calculated figures shown elsewhere on this page are authoritative.
          </p>
        )}
      </div>
    </div>
  );
}
