"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CircleGauge,
  Droplets,
  LayoutDashboard,
  ShieldAlert,
  Users,
} from "lucide-react";

import { ResultCard } from "@/components/result-card";
import { RiskMeter } from "@/components/risk-meter";
import { type AnalysisResponse, Scanner } from "@/components/scanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(value: number | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

export default function Home() {
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const stats = useMemo(
    () => [
      {
        title: "Risk Score",
        value: typeof result?.score === "number" ? `${result.score}/100` : "--",
        icon: <CircleGauge className="h-4 w-4" />,
      },
      {
        title: "Confidence",
        value:
          typeof result?.confidence === "number"
            ? `${Math.round(result.confidence * 100)}%`
            : "--",
        icon: <Activity className="h-4 w-4" />,
      },
      {
        title: "Liquidity",
        value: formatCurrency(result?.liquidity),
        icon: <Droplets className="h-4 w-4" />,
      },
      {
        title: "Top Holder",
        value: formatPercent(result?.topHolderPercent),
        icon: <Users className="h-4 w-4" />,
      },
    ],
    [result],
  );

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-32 top-8 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-6">
          <Card className="animate-rise-in bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 animate-pulse-glow">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                RugShield
              </CardTitle>
              <CardDescription>On-chain token risk intelligence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-400">
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                Scan any ERC-20 token and get a weighted risk score with supporting diagnostics.
              </p>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Model Inputs</p>
                <p>Contract security, liquidity depth, holder concentration, honeypot simulation.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-rise-in [animation-delay:80ms]">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <span className="text-zinc-400">Network</span>
                <span className="text-zinc-200">Ethereum</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <span className="text-zinc-400">Holders</span>
                <span className="text-zinc-200">
                  {result?.sources?.holdersProvider || "Awaiting scan"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <span className="text-zinc-400">Honeypot</span>
                <span className="text-zinc-200">
                  {result?.sources?.honeypotMethod || "Awaiting scan"}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card className="animate-rise-in bg-zinc-950/90">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100 sm:text-3xl">
                    <LayoutDashboard className="h-6 w-6 text-zinc-300" />
                    RugShield Dashboard
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Production token screening console for pre-trade risk checks.
                  </CardDescription>
                </div>
                <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
                  Real-time analysis
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <Scanner onResult={setResult} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => (
              <Card
                key={stat.title}
                className="animate-rise-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <CardContent className="p-4">
                  <div className="mb-3 inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-300">
                    {stat.icon}
                  </div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{stat.title}</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <RiskMeter
              score={result?.score ?? null}
              confidence={result?.confidence ?? null}
              breakdown={result?.breakdown ?? null}
            />
            <ResultCard result={result} />
          </div>
        </section>
      </div>
    </main>
  );
}
