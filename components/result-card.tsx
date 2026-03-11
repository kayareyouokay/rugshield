import { AlertTriangle, ShieldCheck } from "lucide-react";

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
      <Card>
        <CardHeader>
          <CardTitle>Analysis Result</CardTitle>
          <CardDescription>
            Scan a token to view contract metadata and risk warnings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {result.score < 35 ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          )}
          {result.contract || "Unknown Contract"}
        </CardTitle>
        <CardDescription>Token risk analysis snapshot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-400">Liquidity</p>
            <p className="text-lg font-semibold">${result.liquidity.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-400">Top Holder</p>
            <p className="text-lg font-semibold">
              {result.topHolderPercent?.toFixed(2) ?? "0.00"}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-300">Warnings</p>
          <div className="flex flex-wrap gap-2">
            {result.warnings.length ? (
              result.warnings.map((warning) => (
                <Badge key={warning} variant="destructive">
                  {warning}
                </Badge>
              ))
            ) : (
              <Badge variant="default">No high-risk warnings found.</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
