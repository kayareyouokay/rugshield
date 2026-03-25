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
import {
  classifyWarningSeverity,
  getPrimaryRiskFactor,
  getRiskBadgeClass,
  getRiskLabel,
  severityRank,
  summarizeWarnings,
  warningStyle,
} from "@/lib/risk";

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
            Run a scan to see source diagnostics and warning-level details.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const orderedWarnings = [...result.warnings].sort((left, right) => {
    const leftSeverity = classifyWarningSeverity(left);
    const rightSeverity = classifyWarningSeverity(right);
    const bySeverity = severityRank(leftSeverity) - severityRank(rightSeverity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    return left.localeCompare(right);
  });
  const warningSummary = summarizeWarnings(orderedWarnings);
  const primaryFactor = getPrimaryRiskFactor(result.breakdown);

  return (
    <Card className="animate-rise-in [animation-delay:80ms]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="break-all text-base text-zinc-100 sm:text-lg">
              {result.contract || "Unknown Contract"}
            </CardTitle>
            <CardDescription>Diagnostics and warning feed</CardDescription>
          </div>
          <Badge className={getRiskBadgeClass(result.score)}>{getRiskLabel(result.score)} risk</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
          <Badge variant="outline" className="gap-1">
            <Wallet className="h-3.5 w-3.5" /> Holder model
          </Badge>
          <Badge variant="outline">Liquidity depth</Badge>
          <Badge variant="outline">Contract checks</Badge>
          {result.sources?.holdersProvider ? (
            <Badge variant="secondary">Holders via {result.sources.holdersProvider}</Badge>
          ) : null}
          {result.sources?.honeypotMethod ? (
            <Badge variant="secondary">Honeypot {result.sources.honeypotMethod}</Badge>
          ) : null}
          {result.meta?.cache ? (
            <Badge variant="secondary">Cache {result.meta.cache}</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Warning mix</p>
            <p className="mt-1 text-sm text-zinc-200">
              {warningSummary.high} high, {warningSummary.medium} medium, {warningSummary.info} info
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Primary factor</p>
            <p className="mt-1 text-sm text-zinc-200">{primaryFactor?.label || "Insufficient data"}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Confidence</p>
            <p className="mt-1 text-sm text-zinc-200">
              {typeof result.confidence === "number"
                ? `${Math.round(result.confidence * 100)}%`
                : "Unavailable"}
            </p>
          </div>
        </div>

        {result.meta ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Scan Metadata</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-zinc-500">Analyzed:</span> {result.meta.analyzedAddress}
              </p>
              <p>
                <span className="text-zinc-500">Duration:</span> {result.meta.durationMs}ms
              </p>
              <p>
                <span className="text-zinc-500">Generated:</span>{" "}
                {new Date(result.meta.generatedAt).toLocaleString()}
              </p>
              <p className="break-all">
                <span className="text-zinc-500">Request ID:</span> {result.meta.requestId}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-200">Warnings</p>
          {orderedWarnings.length ? (
            <ul className="space-y-2">
              {orderedWarnings.map((warning) => {
                const severity = classifyWarningSeverity(warning);

                return (
                  <li
                    key={warning}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${warningStyle(severity)}`}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              <CircleCheckBig className="h-4 w-4" />
              <span>No high-risk warnings found.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
