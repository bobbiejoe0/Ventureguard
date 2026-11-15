"use client";

import {
  AgentPlatformBackend,
  GoogleAIBackend,
  getAI,
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
  type InferenceSource,
} from "firebase/ai";
import { getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * All AI calls go through Firebase AI Logic.
 * - "quick": PREFER_ON_DEVICE. Chrome's built-in model when available, cloud fallback otherwise.
 * - "detailed": ONLY_IN_CLOUD, for longer analyses that need a bigger model.
 * - "device_only" / "cloud_only": used by the Hybrid diagnostics page to prove each path.
 */
export type AiRoute = "quick" | "detailed" | "device_only" | "cloud_only";

export interface AiResult {
  text: string;
  /** Exactly what the SDK reported. Never inferred or faked. */
  inferenceSource: InferenceSource | "not_reported";
  route: AiRoute;
  latencyMs: number;
  model: string;
}

export type DeviceAvailability = "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

const CLOUD_MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-3.5-flash-lite";
const DETAILED_MODEL = process.env.NEXT_PUBLIC_GEMINI_DETAILED_MODEL || CLOUD_MODEL;

const models = new Map<AiRoute, GenerativeModel>();

function backend() {
  // Gemini Developer API is the default; set NEXT_PUBLIC_AI_BACKEND=agent_platform for the Agent Platform (Vertex) API.
  return process.env.NEXT_PUBLIC_AI_BACKEND === "agent_platform"
    ? new AgentPlatformBackend(process.env.NEXT_PUBLIC_AI_LOCATION || "global")
    : new GoogleAIBackend();
}

const onDeviceParams = {
  createOptions: {
    expectedInputs: [{ type: "text" as const, languages: ["en"] }],
    expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
  },
};

function getModel(route: AiRoute): GenerativeModel {
  const existing = models.get(route);
  if (existing) return existing;
  const ai = getAI(getFirebaseApp(), { backend: backend() });
  const mode =
    route === "quick"
      ? InferenceMode.PREFER_ON_DEVICE
      : route === "device_only"
        ? InferenceMode.ONLY_ON_DEVICE
        : InferenceMode.ONLY_IN_CLOUD;
  const model = getGenerativeModel(ai, {
    mode,
    onDeviceParams,
    inCloudParams: {
      model: route === "detailed" ? DETAILED_MODEL : CLOUD_MODEL,
      generationConfig: { temperature: 0.3, maxOutputTokens: route === "detailed" ? 1400 : 600 },
    },
  });
  models.set(route, model);
  return model;
}

/** Checks Chrome's Prompt API directly. Used only for status display, not to pick the inference source. */
export async function getDeviceAvailability(): Promise<DeviceAvailability> {
  const LM = (globalThis as unknown as { LanguageModel?: { availability: (o?: unknown) => Promise<string> } }).LanguageModel;
  if (!LM) return "unsupported";
  try {
    const a = await LM.availability({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    return (["unavailable", "downloadable", "downloading", "available"].includes(a) ? a : "unavailable") as DeviceAvailability;
  } catch {
    return "unavailable";
  }
}

/** Must be called from a user gesture (click). Downloads Gemini Nano if needed. */
export async function initializeDeviceModel(onProgress?: (p: number) => void): Promise<void> {
  await getModel("quick").initializeDeviceModel(onProgress);
}

export function aiConfigured() {
  return isFirebaseConfigured;
}

export function cloudModelName(route: AiRoute) {
  return route === "detailed" ? DETAILED_MODEL : route === "device_only" ? "Gemini Nano (Chrome)" : CLOUD_MODEL;
}

export async function generate(prompt: string, route: AiRoute = "quick"): Promise<AiResult> {
  const start = performance.now();
  const result = await getModel(route).generateContent(prompt);
  const source = result.response.inferenceSource ?? "not_reported";
  return {
    text: result.response.text(),
    inferenceSource: source,
    route,
    latencyMs: Math.round(performance.now() - start),
    model: source === "on_device" ? "Gemini Nano (Chrome)" : cloudModelName(route),
  };
}
