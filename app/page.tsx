"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { ResultCard } from "@/components/result-card";
import { RiskMeter } from "@/components/risk-meter";
import { type AnalysisResponse, Scanner } from "@/components/scanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.15),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.12),transparent_30%)]" />
      <div className="relative mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="mb-6 border-zinc-800/80 bg-zinc-900/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
              <ShieldAlert className="h-9 w-9 text-emerald-400" />
              RugShield
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-zinc-300">
              Analyze ERC-20 rug-pull risk using contract metadata, liquidity depth, and
              holder concentration signals.
            </p>
            <Scanner onResult={setResult} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <RiskMeter score={result?.score ?? null} />
          <ResultCard result={result} />
        </div>
      </div>
    </main>
  );
}
