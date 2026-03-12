import { getJson } from "@/lib/http";

export interface HoneypotHeuristicInput {
  address: string;
  isProxy: boolean;
  hasMintFunction: boolean;
  hasOwnerPrivileges: boolean;
  liquidityUsd: number;
}

export interface HoneypotAnalysisResult {
  warnings: string[];
  risk: number;
  confidence: number;
  heuristicTag: "api" | "heuristic";
  verdict: "low" | "medium" | "high" | "unknown";
}

interface HoneypotApiResponse {
  honeypotResult?: {
    isHoneypot?: boolean;
    honeypotReason?: string;
  };
  simulationResult?: {
    buyTax?: number | string;
    sellTax?: number | string;
    transferTax?: number | string;
  };
  summary?: {
    risk?: string;
    riskLevel?: number;
    flags?: Array<{
      flag?: string;
      severity?: string;
    }>;
  };
}

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferVerdict(risk: number): HoneypotAnalysisResult["verdict"] {
  if (risk >= 60) {
    return "high";
  }

  if (risk >= 30) {
    return "medium";
  }

  return "low";
}

function heuristicFallback(input: HoneypotHeuristicInput): HoneypotAnalysisResult {
  const warnings: string[] = [];
  let risk = 0;

  if (input.hasOwnerPrivileges && input.hasMintFunction) {
    warnings.push("Owner + mint controls detected; token has elevated honeypot-style risk.");
    risk += 12;
  }

  if (input.isProxy && input.liquidityUsd < 100_000) {
    warnings.push("Proxy token with thin liquidity increases exit-risk uncertainty.");
    risk += 10;
  }

  if (input.liquidityUsd < 15_000) {
    warnings.push("Very low liquidity makes sellability hard to validate.");
    risk += 8;
  }

  const clampedRisk = clampRisk(risk);

  return {
    warnings,
    risk: clampedRisk,
    confidence: 0.45,
    heuristicTag: "heuristic",
    verdict: clampedRisk === 0 ? "unknown" : inferVerdict(clampedRisk),
  };
}

export async function analyzeHoneypotHeuristic(
  input: HoneypotHeuristicInput,
): Promise<HoneypotAnalysisResult> {
  const response = await getJson<HoneypotApiResponse>({
    source: "Honeypot.is",
    url: "https://api.honeypot.is/v2/IsHoneypot",
    params: {
      address: input.address,
    },
    timeoutMs: 7_000,
    retries: 1,
  });

  if (!response.ok) {
    const fallback = heuristicFallback(input);
    fallback.warnings.unshift(`Honeypot simulation unavailable: ${response.error}`);
    return fallback;
  }

  const warnings: string[] = [];
  let risk = 0;

  if (response.data.honeypotResult?.isHoneypot) {
    warnings.push(
      response.data.honeypotResult.honeypotReason
        ? `Honeypot simulation flagged risk: ${response.data.honeypotResult.honeypotReason}`
        : "Honeypot simulation flagged this token as a honeypot.",
    );
    risk += 60;
  }

  const buyTax = toNumber(response.data.simulationResult?.buyTax);
  const sellTax = toNumber(response.data.simulationResult?.sellTax);
  const transferTax = toNumber(response.data.simulationResult?.transferTax);

  const maxTax = Math.max(buyTax, sellTax, transferTax);

  if (maxTax >= 30) {
    warnings.push("Token tax is above 30%, making exits highly risky.");
    risk += 28;
  } else if (maxTax >= 15) {
    warnings.push("Token tax is above 15%.");
    risk += 14;
  } else if (maxTax >= 8) {
    warnings.push("Token tax is above 8%.");
    risk += 7;
  }

  const flags = response.data.summary?.flags ?? [];
  const highSeverityFlags = flags.filter((flag) =>
    ["high", "critical"].includes(String(flag.severity ?? "").toLowerCase()),
  );

  if (highSeverityFlags.length) {
    warnings.push(
      `Honeypot simulation reported ${highSeverityFlags.length} high-severity flag(s).`,
    );
    risk += Math.min(20, highSeverityFlags.length * 6);
  }

  const clampedRisk = clampRisk(risk);

  return {
    warnings,
    risk: clampedRisk,
    confidence: 0.9,
    heuristicTag: "api",
    verdict: inferVerdict(clampedRisk),
  };
}
