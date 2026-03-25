export type WarningSeverity = "high" | "medium" | "info";

export interface RiskBreakdown {
  contract: number;
  liquidity: number;
  holders: number;
  honeypot: number;
}

export function classifyWarningSeverity(warning: string): WarningSeverity {
  const normalized = warning.toLowerCase();

  if (
    normalized.includes("honeypot") ||
    normalized.includes("high-severity") ||
    normalized.includes("exceeds 60%") ||
    normalized.includes("over 90%") ||
    normalized.includes("unverified") ||
    normalized.includes("mint") ||
    normalized.includes("owner-controlled")
  ) {
    return "high";
  }

  if (
    normalized.includes("proxy") ||
    normalized.includes("below $100,000") ||
    normalized.includes("below $25,000") ||
    normalized.includes("under 3%") ||
    normalized.includes("tax is above") ||
    normalized.includes("fallback")
  ) {
    return "medium";
  }

  return "info";
}

export function warningStyle(severity: WarningSeverity) {
  if (severity === "high") {
    return "border-rose-900/70 bg-rose-950/50 text-rose-300";
  }

  if (severity === "medium") {
    return "border-amber-900/70 bg-amber-950/50 text-amber-300";
  }

  return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
}

export function severityRank(severity: WarningSeverity) {
  if (severity === "high") {
    return 0;
  }

  if (severity === "medium") {
    return 1;
  }

  return 2;
}

export function getRiskLabel(score: number) {
  if (score < 35) return "Low";
  if (score < 70) return "Medium";
  return "High";
}

export function getRiskBadgeClass(score: number) {
  if (score < 35) return "border-emerald-900/60 bg-emerald-950/60 text-emerald-300";
  if (score < 70) return "border-amber-900/60 bg-amber-950/60 text-amber-300";
  return "border-rose-900/60 bg-rose-950/60 text-rose-300";
}

export function summarizeWarnings(warnings: string[]) {
  return warnings.reduce(
    (summary, warning) => {
      const severity = classifyWarningSeverity(warning);
      summary[severity] += 1;
      return summary;
    },
    { high: 0, medium: 0, info: 0 },
  );
}

export function getPrimaryRiskFactor(breakdown: RiskBreakdown | null | undefined) {
  if (!breakdown) {
    return null;
  }

  const factors = [
    { key: "contract", label: "Contract controls", value: breakdown.contract },
    { key: "liquidity", label: "Liquidity depth", value: breakdown.liquidity },
    { key: "holders", label: "Holder concentration", value: breakdown.holders },
    { key: "honeypot", label: "Honeypot checks", value: breakdown.honeypot },
  ];

  return factors.sort((left, right) => right.value - left.value)[0];
}
