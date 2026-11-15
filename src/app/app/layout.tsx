"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BrainCircuit,
  Cloud,
  CloudOff,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogOut,
  Menu,
  Radar,
  RefreshCw,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cx } from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/decisions", label: "Decision Lab", icon: FlaskConical },
  { href: "/app/policies", label: "PolicyGuard", icon: ShieldCheck },
  { href: "/app/risks", label: "Risk Radar", icon: Radar },
  { href: "/app/advisor", label: "AI Advisor", icon: BrainCircuit },
  { href: "/app/recovery", label: "Recovery Mode", icon: LifeBuoy },
  { href: "/app/hybrid", label: "Hybrid AI Lab", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function SyncIndicator() {
  const { mode, sync, online } = useWorkspace();
  if (!online)
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#a86b12]">
        <CloudOff className="h-3.5 w-3.5" /> Offline: calculations still work
      </span>
    );
  if (mode === "demo")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-warn" /> Demo mode: saved on this device
      </span>
    );
  if (sync === "pending")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Syncing changes…
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <Cloud className="h-3.5 w-3.5 text-good" /> Synced to Firestore
    </span>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ws.ready) return;
    if (ws.mode === "none") router.replace("/");
    else if (!ws.business) router.replace("/onboarding");
  }, [ws.ready, ws.mode, ws.business, router]);

  if (!ws.ready || !ws.business) {
    // Still render the page segment (hidden) so Next.js can validate instant navigation.
    // Pages render nothing until a business exists; the key change remounts them once it loads.
    return (
      <>
        <div className="flex min-h-screen items-center justify-center text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your business…
        </div>
        <div hidden key="loading">
          {children}
        </div>
      </>
    );
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              active ? "bg-white/12 text-white" : "text-navy-100/75 hover:bg-white/6 hover:text-white",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <div className="truncate text-sm font-medium text-white">{ws.business.name}</div>
      <div className="truncate text-xs text-navy-100/60">{ws.user?.email ?? "Demo workspace"}</div>
      <button
        onClick={async () => {
          if (ws.mode === "demo") ws.resetDemo();
          else await ws.signOut();
          router.replace("/");
        }}
        className="mt-3 flex items-center gap-2 text-xs text-navy-100/70 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" /> {ws.mode === "demo" ? "Exit demo" : "Sign out"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 lg:flex">
        <div className="px-6 py-6">
          <Link href="/app">
            <Logo light />
          </Link>
        </div>
        {nav}
        {footer}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy-900">
            <div className="flex items-center justify-between px-6 py-6">
              <Logo light />
              <button onClick={() => setOpen(false)} className="text-white" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="lg:hidden">
              <Logo />
            </span>
          </div>
          <span className="hidden sm:block">
            <SyncIndicator />
          </span>
        </header>
        <main key={path} className="page-enter mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
