import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Brain,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * CivicPulse landing page. Server Component, CSS-only motion (no JS animation
 * deps). Sections each use a distinct layout family; blue is the single accent.
 */
export default function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      <Hero />
      <Innovations />
      <Pipeline />
      <Impact />
      <Stack />
      <CtaBand />
      <Footer />
    </div>
  );
}

// ── Hero: asymmetric split, real agent-reasoning card as the visual ──
function Hero() {
  return (
    <section className="relative">
      {/* faint dotted backdrop, pure CSS */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.6] [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <span className="reveal-up inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground" style={{ ["--d" as string]: "0ms" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse-soft" />
            Autonomous civic resolution
          </span>
          <h1
            className="reveal-up mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            style={{ ["--d" as string]: "80ms" }}
          >
            Report once.
            <br />
            The AI handles the rest.
          </h1>
          <p
            className="reveal-up mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground"
            style={{ ["--d" as string]: "160ms" }}
          >
            An autonomous agent monitors civic issues, reasons step by step,
            escalates to the right department, and self-corrects when it fails.
          </p>
          <div className="reveal-up mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "240ms" }}>
            <Link
              href="/map"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group transition-transform hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              Explore the live map
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/agent"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "transition-transform hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              Watch the agent
            </Link>
          </div>
        </div>

        {/* Real product artifact: the agent's actual reasoning output */}
        <div
          className="reveal-up float-soft relative"
          style={{ ["--d" as string]: "320ms" }}
        >
          <div className="rounded-2xl border bg-card p-5 shadow-xl shadow-primary/5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">Resolution Agent</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse-soft" />
                reasoning
              </span>
            </div>

            <div className="space-y-2.5">
              <ReasonLine
                tone="blue"
                badge="escalate · critical"
                text="Pothole open 58h, 4 verifications, never escalated. Routing to Roads and PWD."
              />
              <ReasonLine
                tone="amber"
                badge="self-correction"
                text="Primary escalation failed. Retrying with the Municipal Commissioner's Office."
              />
              <ReasonLine
                tone="violet"
                badge="prediction"
                text="4 repairs in this zone over 90 days. Pre-emptive alert sent before the next report."
              />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">Indore Civic Score</span>
              <span className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-green-600">82</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReasonLine({
  tone,
  badge,
  text,
}: {
  tone: "blue" | "amber" | "violet";
  badge: string;
  text: string;
}) {
  const tones = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-800",
    violet: "bg-violet-100 text-violet-700",
  } as const;
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone])}>
        {badge}
      </span>
      <p className="mt-1.5 text-sm leading-snug text-foreground">{text}</p>
    </div>
  );
}

// ── Innovations: asymmetric bento, not three equal cards ──
function Innovations() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        Three things no civic platform has done before.
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {/* Large feature */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] p-7 md:col-span-2 md:row-span-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-xl font-semibold">Predictive hotspot alerts</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            The agent spots recurring problem zones from 90 days of resolved
            history and alerts the department before the next complaint is filed.
          </p>
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-full border-2 border-dashed border-amber-400/60"
          />
        </div>

        <div className="rounded-2xl border bg-card p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <RefreshCw className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-xl font-semibold">Agent self-correction</h3>
          <p className="mt-2 text-muted-foreground">
            When an escalation fails, the agent retries with a higher authority
            on its own. No human nudge.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Gauge className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-xl font-semibold">Live Civic Score</h3>
          <p className="mt-2 text-muted-foreground">
            One 0-100 city-health number, recalculated the moment an issue
            resolves.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border bg-secondary p-7 md:col-span-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Memory across cycles.</span>{" "}
            The agent checks what it already tried on every issue before acting,
            so it never repeats itself or spams a department.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Pipeline: horizontal process flow (verbs, not "Step 1/2/3") ──
function Pipeline() {
  const steps = [
    { icon: Eye, name: "Monitor", line: "Pulls every open issue, sorted by severity and age." },
    { icon: Brain, name: "Reason", line: "Checks its memory, then decides the right action." },
    { icon: Zap, name: "Act", line: "Escalates, merges duplicates, or flags for review." },
    { icon: RefreshCw, name: "Self-correct", line: "If an action fails, it adapts and tries again." },
  ];
  return (
    <section className="border-y bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          How the agent resolves an issue.
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.name} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
                {i < steps.length - 1 && (
                  <span className="hidden h-px flex-1 bg-border lg:block" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Impact: asymmetric editorial moment, score woven into prose ──
function Impact() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24">
      <div className="grid items-end gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="max-w-xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Impact you can watch happen, the instant it happens.
          </h2>
          <p className="mt-4 max-w-md text-pretty text-muted-foreground">
            The Indore Civic Score recalculates the moment an issue resolves.
            Last month it tracked 24 resolutions at a 4.2-day average, across the
            agent&apos;s 9 tools.
          </p>
        </div>
        <div className="flex items-baseline gap-3 lg:justify-end">
          <span className="text-7xl font-extrabold tracking-tight text-green-600 sm:text-8xl">82</span>
          <div className="pb-2">
            <div className="text-2xl font-medium text-muted-foreground">/100</div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse-soft" />
              live
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Stack: Google tech, simple wrap ──
function Stack() {
  const tech = [
    "Gemini Flash (vision + function calling)",
    "Cloud Firestore",
    "Google Maps Platform",
    "Cloud Natural Language",
    "Firebase Cloud Messaging",
    "Cloud Pub/Sub",
    "Cloud Run",
    "Firebase Auth",
    "Firebase Storage",
  ];
  return (
    <section className="border-t bg-secondary/40">
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Built on Google&apos;s AI and cloud stack.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {tech.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA band: single intent, white-on-blue ──
function CtaBand() {
  return (
    <section className="bg-primary">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-20 text-center">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
          See it resolve a real issue.
        </h2>
        <p className="max-w-md text-primary-foreground/80">
          Snap a photo, drop a pin, and let the agent take it from there. Around
          45 seconds end to end.
        </p>
        <Link
          href="/report"
          className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-primary shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <MapPin className="h-5 w-5" />
          Report an issue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row">
        <div className="flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          Civic<span className="-ml-1.5 text-primary">Pulse</span>
        </div>
        <p className="text-sm text-muted-foreground">Report once. The AI handles the rest.</p>
        <nav className="flex gap-5 text-sm font-medium text-muted-foreground">
          <Link href="/map" className="hover:text-foreground">Map</Link>
          <Link href="/agent" className="hover:text-foreground">Agent</Link>
          <Link href="/report" className="hover:text-foreground">Report</Link>
        </nav>
      </div>
    </footer>
  );
}
