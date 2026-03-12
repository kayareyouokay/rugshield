import { AlertTriangle, CircleCheckBig, Shield, Wallet } from "lucide-react";

import type { AnalysisResponse } from "@/components/scanner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ResultCardProps {
  result: AnalysisResponse | null;
}

export function ResultCard({ result }: ResultCardProps) {
  if (!result) {
    return (
      <Card className="animate-rise-in [animation-delay:80ms]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Shield className="h-5 w-5 text-zinc-300" />
            Analysis Details
          </CardTitle>
          <CardDescription>
            Run a scan to see contract details, risk warnings, and source diagnostics.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="animate-rise-in [animation-delay:80ms]">
      <CardHeader>
        <CardTitle className="break-all text-base text-zinc-100 sm:text-lg">
          {result.contract || "Unknown Contract"}
        </CardTitle>
        <CardDescription>Token diagnostics</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Liquidity</p>
            <p className="text-xl font-semibold text-zinc-100">${result.liquidity.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Top Holder</p>
            <p className="text-xl font-semibold text-zinc-100">
              {result.topHolderPercent?.toFixed(2) ?? "0.00"}%
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Top 10 Holders</p>
            <p className="text-xl font-semibold text-zinc-100">
              {result.top10HolderPercent?.toFixed(2) ?? "0.00"}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-200">Warnings</p>
          {result.warnings.length ? (
            <ul className="space-y-2">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 rounded-lg border border-rose-900/70 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              <CircleCheckBig className="h-4 w-4" />
              <span>No high-risk warnings found.</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
          <Badge variant="outline" className="gap-1">
            <Wallet className="h-3.5 w-3.5" /> Holder model
          </Badge>
          <Badge variant="outline">Liquidity depth</Badge>
          <Badge variant="outline">Contract checks</Badge>
          {typeof result.confidence === "number" ? (
            <Badge variant="secondary">Confidence {Math.round(result.confidence * 100)}%</Badge>
          ) : null}
          {result.sources?.holdersProvider ? (
            <Badge variant="secondary">Holders via {result.sources.holdersProvider}</Badge>
          ) : null}
          {result.sources?.honeypotMethod ? (
            <Badge variant="secondary">Honeypot {result.sources.honeypotMethod}</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
