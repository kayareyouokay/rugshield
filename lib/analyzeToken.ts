import { isAddress } from "ethers";

import { analyzeContractRisk } from "@/lib/analysis/contract";
import { analyzeHolderConcentration } from "@/lib/analysis/holders";
import { analyzeHoneypotHeuristic } from "@/lib/analysis/honeypot";
import { analyzeLiquidityRisk } from "@/lib/analysis/liquidity";

export interface AnalyzeTokenResult {
  score: number;
  confidence: number;
  contract: string;
  liquidity: number;
  warnings: string[];
  topHolderPercent: number;
  top10HolderPercent: number;
  breakdown: {
    contract: number;
    liquidity: number;
    holders: number;
    honeypot: number;
  };
  sources: {
    holdersProvider: string;
    honeypotMethod: string;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value);
}

function getTimeoutMs(envKey: string, fallbackMs: number) {
  const configured = Number(process.env[envKey]);
  if (Number.isFinite(configured) && configured >= 500) {
    return Math.round(configured);
  }

  return fallbackMs;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallbackValue);
    }, timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
}

export async function analyzeToken(address: string): Promise<AnalyzeTokenResult> {
  if (!isAddress(address)) {
    return {
      score: 100,
      confidence: 1,
      contract: "Invalid Address",
      liquidity: 0,
      warnings: ["Provided token address is not a valid EVM address."],
      topHolderPercent: 0,
      top10HolderPercent: 0,
      breakdown: {
        contract: 100,
        liquidity: 100,
        holders: 100,
        honeypot: 100,
      },
      sources: {
        holdersProvider: "none",
        honeypotMethod: "validation",
      },
    };
  }

  const contractTimeoutMs = getTimeoutMs("ANALYSIS_TIMEOUT_CONTRACT_MS", 4_000);
  const liquidityTimeoutMs = getTimeoutMs("ANALYSIS_TIMEOUT_LIQUIDITY_MS", 3_000);
  const holdersTimeoutMs = getTimeoutMs("ANALYSIS_TIMEOUT_HOLDERS_MS", 3_500);
  const honeypotTimeoutMs = getTimeoutMs("ANALYSIS_TIMEOUT_HONEYPOT_MS", 2_500);

  const contractPromise = withTimeout(
    analyzeContractRisk(address),
    contractTimeoutMs,
    {
      contractName: "Unknown Contract",
      warnings: [`Contract analysis timed out after ${contractTimeoutMs}ms.`],
      risk: 18,
      confidence: 0.2,
      isVerified: false,
      isProxy: false,
      hasMintFunction: false,
      hasOwnerPrivileges: false,
    },
  );

  const liquidityPromise = withTimeout(
    analyzeLiquidityRisk(address),
    liquidityTimeoutMs,
    {
      liquidityUsd: 0,
      warnings: [`Liquidity analysis timed out after ${liquidityTimeoutMs}ms.`],
      risk: 30,
      confidence: 0.2,
      hasPool: false,
    },
  );

  const holdersPromise = withTimeout(
    analyzeHolderConcentration(address),
    holdersTimeoutMs,
    {
      topHolderPercent: 0,
      top10HolderPercent: 0,
      warnings: [`Holder analysis timed out after ${holdersTimeoutMs}ms.`],
      risk: 15,
      confidence: 0.2,
      provider: "none" as const,
    },
  );

  const [contractAnalysis, liquidityAnalysis] = await Promise.all([
    contractPromise,
    liquidityPromise,
  ]);

  const honeypotPromise = withTimeout(
    analyzeHoneypotHeuristic({
      address,
      isProxy: contractAnalysis.isProxy,
      hasMintFunction: contractAnalysis.hasMintFunction,
      hasOwnerPrivileges: contractAnalysis.hasOwnerPrivileges,
      liquidityUsd: liquidityAnalysis.liquidityUsd,
    }),
    honeypotTimeoutMs,
    {
      warnings: [`Honeypot analysis timed out after ${honeypotTimeoutMs}ms.`],
      risk: 8,
      confidence: 0.3,
      heuristicTag: "heuristic" as const,
      verdict: "unknown" as const,
    },
  );

  const [holderAnalysis, honeypotAnalysis] = await Promise.all([
    holdersPromise,
    honeypotPromise,
  ]);

  const weights = {
    contract: 0.35,
    liquidity: 0.3,
    holders: 0.2,
    honeypot: 0.15,
  };

  const baseScore =
    contractAnalysis.risk * weights.contract +
    liquidityAnalysis.risk * weights.liquidity +
    holderAnalysis.risk * weights.holders +
    honeypotAnalysis.risk * weights.honeypot;

  const confidence = clamp(
    contractAnalysis.confidence * weights.contract +
      liquidityAnalysis.confidence * weights.liquidity +
      holderAnalysis.confidence * weights.holders +
      honeypotAnalysis.confidence * weights.honeypot,
    0,
    1,
  );

  const uncertaintyPenalty = (1 - confidence) * 16;
  const totalRisk = clamp(round(baseScore + uncertaintyPenalty), 0, 100);

  const warnings = [
    ...contractAnalysis.warnings,
    ...liquidityAnalysis.warnings,
    ...holderAnalysis.warnings,
    ...honeypotAnalysis.warnings,
  ];

  return {
    score: totalRisk,
    confidence: Number(confidence.toFixed(2)),
    contract: contractAnalysis.contractName,
    liquidity: round(liquidityAnalysis.liquidityUsd),
    warnings: Array.from(new Set(warnings)),
    topHolderPercent: Number(holderAnalysis.topHolderPercent.toFixed(2)),
    top10HolderPercent: Number(holderAnalysis.top10HolderPercent.toFixed(2)),
    breakdown: {
      contract: contractAnalysis.risk,
      liquidity: liquidityAnalysis.risk,
      holders: holderAnalysis.risk,
      honeypot: honeypotAnalysis.risk,
    },
    sources: {
      holdersProvider: holderAnalysis.provider,
      honeypotMethod: honeypotAnalysis.heuristicTag,
    },
  };
}
