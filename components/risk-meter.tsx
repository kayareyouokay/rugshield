import { AlertTriangle, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Progress } from "@/components/ui/progress";

interface RiskMeterProps {
  score: number | null;
  confidence?: number | null;
  breakdown?: {
    contract: number;
    liquidity: number;
    holders: number;
    honeypot: number;
  } | null;
}

function getRiskLabel(score: number) {
  if (score < 35) return "Low";
  if (score < 70) return "Medium";
  return "High";
}

function getRiskBadgeClass(score: number) {
  if (score < 35) return "border-emerald-900/60 bg-emerald-950/60 text-emerald-300";
  if (score < 70) return "border-amber-900/60 bg-amber-950/60 text-amber-300";
  return "border-rose-900/60 bg-rose-950/60 text-rose-300";
}

export function RiskMeter({ score, confidence, breakdown }: RiskMeterProps) {
  if (score === null) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 animate-rise-in">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-300">
            <ShieldQuestion className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-100">Risk Meter</p>
            <p className="text-sm text-zinc-500">Run a scan to populate this panel.</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-zinc-800 shimmer" />
      </div>
    );
  }

  const label = getRiskLabel(score);
  const riskIcon = score < 35 ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;

  const breakdownRows = breakdown
    ? [
        { key: "contract", label: "Contract", value: breakdown.contract },
        { key: "liquidity", label: "Liquidity", value: breakdown.liquidity },
        { key: "holders", label: "Holders", value: breakdown.holders },
        { key: "honeypot", label: "Honeypot", value: breakdown.honeypot },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 animate-rise-in">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Risk Score</p>
          <p className="text-sm text-zinc-500">
            Composite risk from contract, liquidity, holders, and honeypot checks
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${getRiskBadgeClass(score)}`}
        >
          {riskIcon}
          {label}
        </span>
      </div>

      <div className="mb-4 flex items-end gap-1">
        <p className="text-5xl font-semibold leading-none text-zinc-100">{score}</p>
        <p className="mb-1 text-sm text-zinc-500">/100</p>
      </div>

      <Progress value={score} />

      {typeof confidence === "number" ? (
        <p className="mt-3 text-xs text-zinc-500">Model confidence: {Math.round(confidence * 100)}%</p>
      ) : null}

      {breakdownRows.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {breakdownRows.map((row) => (
            <div key={row.key} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-zinc-400">{row.label}</p>
                <p className="text-xs font-medium text-zinc-300">{row.value}</p>
              </div>
              <Progress value={row.value} className="h-2" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
