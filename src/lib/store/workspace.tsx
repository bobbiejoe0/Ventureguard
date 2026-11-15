"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import type { Business, BusinessPolicy } from "@/engine/types";
import type { DecisionType } from "@/engine/decisions";
import type { SimulationAssumptions } from "@/engine/scenarios";
import { DEFAULT_POLICIES } from "@/engine/policies";
import { NOVA_BRANCH_INPUTS, novaRetail } from "@/engine/demo";
import { DEFAULT_ASSUMPTIONS, simulateDecision } from "@/engine/scenarios";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export interface SavedSimulation {
  id: string;
  title: string;
  decisionType: DecisionType;
  inputs: Record<string, number>;
  assumptions: SimulationAssumptions;
  headline: { expectedMonthlyProfit: number; lowestCash: number; violations: number };
  createdAt: string;
}

export interface SavedInsight {
  id: string;
  question: string;
  text: string;
  inferenceSource: string;
  route: string;
  model: string;
  latencyMs: number;
  unverified: string[];
  createdAt: string;
}

export type Mode = "none" | "demo" | "cloud";
export type SyncState = "local" | "synced" | "pending" | "offline";

interface WorkspaceState {
  ready: boolean;
  mode: Mode;
  user: User | null;
  business: Business | null;
  policies: BusinessPolicy[];
  simulations: SavedSimulation[];
  insights: SavedInsight[];
  sync: SyncState;
  online: boolean;
}

interface WorkspaceApi extends WorkspaceState {
  startDemo: () => void;
  saveBusiness: (b: Business) => Promise<void>;
  savePolicies: (p: BusinessPolicy[]) => Promise<void>;
  saveSimulation: (s: SavedSimulation) => Promise<void>;
  deleteSimulation: (id: string) => Promise<void>;
  saveInsight: (i: SavedInsight) => Promise<void>;
  resetDemo: () => void;
  signOut: () => Promise<void>;
}

const LOCAL_KEY = "ventureguard.demo.v1";
const Ctx = createContext<WorkspaceApi | null>(null);

/** Firestore rejects `undefined`; JSON round-trip strips it. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

interface LocalData {
  business: Business | null;
  policies: BusinessPolicy[];
  simulations: SavedSimulation[];
  insights: SavedInsight[];
}

function readLocal(): LocalData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalData) : null;
  } catch {
    return null;
  }
}

function writeLocal(d: LocalData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable (private mode); data stays in memory */
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({
    ready: false,
    mode: "none",
    user: null,
    business: null,
    policies: DEFAULT_POLICIES,
    simulations: [],
    insights: [],
    sync: "local",
    online: true,
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Online / offline tracking
  useEffect(() => {
    const update = () => setState((s) => ({ ...s, online: navigator.onLine }));
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Auth + Firestore subscriptions, or local demo data
  useEffect(() => {
    const local = readLocal();
    const loadDemo = () => {
      if (local?.business) {
        setState((s) => ({ ...s, ready: true, mode: "demo", user: null, ...local, sync: "local" }));
      } else {
        setState((s) => ({ ...s, ready: true, mode: "none", user: null }));
      }
    };
    if (!isFirebaseConfigured) {
      loadDemo();
      return;
    }
    let unsubs: (() => void)[] = [];
    const stopAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubs.forEach((u) => u());
      unsubs = [];
      if (!user) {
        loadDemo();
        return;
      }
      const db = getDb();
      const bizRef = doc(db, "businesses", user.uid);
      setState((s) => ({ ...s, user, mode: "cloud", ready: false }));
      unsubs.push(
        onSnapshot(
          bizRef,
          { includeMetadataChanges: true },
          (snap) => {
            const data = snap.data() as (Business & { policies?: BusinessPolicy[] }) | undefined;
            const sync: SyncState = snap.metadata.hasPendingWrites ? "pending" : snap.metadata.fromCache ? "offline" : "synced";
            const { policies, ...biz } = data ?? {};
            setState((s) => ({
              ...s,
              ready: true,
              // A doc with only `policies` (no name yet) means onboarding isn't finished.
              business: data && "name" in biz ? (biz as Business) : null,
              policies: policies?.length ? policies : DEFAULT_POLICIES,
              sync,
            }));
          },
          (err) => {
            console.error("[VentureGuard] business snapshot", err);
            setState((s) => ({ ...s, ready: true }));
          },
        ),
      );
      unsubs.push(
        onSnapshot(query(collection(bizRef, "simulations"), orderBy("createdAt", "desc"), limit(30)), (snap) =>
          setState((s) => ({ ...s, simulations: snap.docs.map((d) => d.data() as SavedSimulation) })),
        ),
      );
      unsubs.push(
        onSnapshot(query(collection(bizRef, "insights"), orderBy("createdAt", "desc"), limit(30)), (snap) =>
          setState((s) => ({ ...s, insights: snap.docs.map((d) => d.data() as SavedInsight) })),
        ),
      );
    });
    return () => {
      stopAuth();
      unsubs.forEach((u) => u());
    };
  }, []);

  const persistLocal = useCallback((patch: Partial<LocalData>) => {
    setState((s) => {
      const next = { ...s, ...patch };
      writeLocal({ business: next.business, policies: next.policies, simulations: next.simulations, insights: next.insights });
      return next;
    });
  }, []);

  const bizRef = () => doc(getDb(), "businesses", stateRef.current.user!.uid);

  // Firestore writes resolve only after the server acknowledges them. We don't await
  // them so the UI stays responsive offline; the local cache updates instantly and
  // the sync indicator shows pending writes.
  const fire = (p: Promise<unknown>) => p.catch((e) => console.error("[VentureGuard] sync failed", e));

  const api: WorkspaceApi = useMemo(
    () => ({
      ...state,
      startDemo: () => {
        const business = novaRetail("demo", new Date().toISOString());
        const sim = simulateDecision(business, "open_branch", NOVA_BRANCH_INPUTS, DEFAULT_POLICIES).scenarios.expected;
        const seeded: SavedSimulation = {
          id: newId(),
          title: "Open a second branch",
          decisionType: "open_branch",
          inputs: NOVA_BRANCH_INPUTS,
          assumptions: DEFAULT_ASSUMPTIONS,
          headline: { expectedMonthlyProfit: sim.decisionMonthlyProfit, lowestCash: sim.minCash, violations: sim.policyChecks.filter((c) => !c.passed).length },
          createdAt: new Date().toISOString(),
        };
        const data: LocalData = { business, policies: DEFAULT_POLICIES, simulations: [seeded], insights: [] };
        writeLocal(data);
        setState((s) => ({ ...s, ...data, mode: "demo", ready: true, sync: "local" }));
      },
      resetDemo: () => {
        try {
          localStorage.removeItem(LOCAL_KEY);
        } catch {}
        setState((s) => ({ ...s, mode: "none", business: null, policies: DEFAULT_POLICIES, simulations: [], insights: [] }));
      },
      saveBusiness: async (b) => {
        const ts = new Date().toISOString();
        const updated = { ...b, createdAt: b.createdAt || ts, updatedAt: ts };
        if (stateRef.current.mode === "cloud") {
          const owner = stateRef.current.user!.uid;
          fire(setDoc(bizRef(), clean({ ...updated, id: owner, ownerId: owner, policies: stateRef.current.policies })));
          setState((s) => ({ ...s, business: { ...updated, id: owner, ownerId: owner } }));
        } else persistLocal({ business: updated });
        if (stateRef.current.mode === "none") setState((s) => ({ ...s, mode: "demo" }));
      },
      savePolicies: async (p) => {
        if (stateRef.current.mode === "cloud") {
          fire(setDoc(bizRef(), clean({ policies: p }), { merge: true }));
          setState((s) => ({ ...s, policies: p }));
        } else persistLocal({ policies: p });
      },
      saveSimulation: async (sim) => {
        if (stateRef.current.mode === "cloud") fire(setDoc(doc(bizRef(), "simulations", sim.id), clean(sim)));
        else persistLocal({ simulations: [sim, ...stateRef.current.simulations].slice(0, 30) });
      },
      deleteSimulation: async (id) => {
        if (stateRef.current.mode === "cloud") fire(deleteDoc(doc(bizRef(), "simulations", id)));
        else persistLocal({ simulations: stateRef.current.simulations.filter((s) => s.id !== id) });
      },
      saveInsight: async (i) => {
        if (stateRef.current.mode === "cloud") fire(setDoc(doc(bizRef(), "insights", i.id), clean(i)));
        else persistLocal({ insights: [i, ...stateRef.current.insights].slice(0, 30) });
      },
      signOut: async () => {
        if (isFirebaseConfigured) await fbSignOut(getFirebaseAuth());
      },
    }),
    [state, persistLocal],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
