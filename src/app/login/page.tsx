"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { Logo } from "@/components/Logo";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { useWorkspace } from "@/lib/store/workspace";

type Mode = "login" | "register" | "reset";

function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Incorrect email or password.";
  if (code.includes("email-already-in-use")) return "An account with this email already exists. Try logging in.";
  if (code.includes("weak-password")) return "Use at least 6 characters for your password.";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("network")) return "Network error. Check your connection.";
  return (e as Error)?.message ?? "Something went wrong.";
}

function AuthForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ws = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (ws.ready && ws.mode === "cloud") router.replace(ws.business ? "/app" : "/onboarding");
  }, [ws.ready, ws.mode, ws.business, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (mode === "login") await signInWithEmailAndPassword(auth, email, password);
      else if (mode === "register") await createUserWithEmailAndPassword(auth, email, password);
      else {
        await sendPasswordResetEmail(auth, email);
        setMsg({ ok: true, text: "Check your inbox for a password reset link." });
      }
    } catch (err) {
      setMsg({ ok: false, text: authMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <Logo />
      <h1 className="mt-6 text-xl font-semibold">{mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Reset your password"}</h1>
      <p className="mt-1 text-sm text-muted">{mode === "register" ? "Your business data is private to your account." : mode === "reset" ? "We'll email you a reset link." : "Log in to your VentureGuard workspace."}</p>

      {!isFirebaseConfigured ? (
        <div className="mt-6 rounded-xl bg-warn-soft p-4 text-[13px] text-[#7a4f0e]">
          Firebase isn&apos;t configured in this build, so accounts are unavailable. You can still explore everything with the demo workspace.
          <Button
            className="mt-3 w-full"
            onClick={() => {
              ws.startDemo();
              router.push("/app");
            }}
          >
            Open demo workspace
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email">
            <input type="email" required autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode !== "reset" && (
            <Field label="Password">
              <input type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          {msg && <p className={`text-[13px] ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            {mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
          </Button>
          <div className="flex justify-between text-[13px]">
            {mode === "login" ? (
              <>
                <button type="button" className="text-navy-700 hover:underline" onClick={() => setMode("register")}>Create account</button>
                <button type="button" className="text-muted hover:underline" onClick={() => setMode("reset")}>Forgot password?</button>
              </>
            ) : (
              <button type="button" className="text-navy-700 hover:underline" onClick={() => setMode("login")}>Back to log in</button>
            )}
          </div>
        </form>
      )}
      <div className="mt-6 border-t border-line pt-4 text-center text-[13px] text-muted">
        Just looking?{" "}
        <button
          className="font-medium text-navy-700 hover:underline"
          onClick={() => {
            ws.startDemo();
            router.push("/app");
          }}
        >
          Try the Nova Retail demo
        </button>{" "}
        · <Link href="/" className="hover:underline">Home</Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
