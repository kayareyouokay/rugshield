import { isAddress } from "ethers";

import {
  type ContractAnalysisResult,
  analyzeContractRisk,
} from "@/lib/analysis/contract";
import {
  type HolderAnalysisResult,
  analyzeHolderConcentration,
} from "@/lib/analysis/holders";
import {
  type HoneypotAnalysisResult,
  analyzeHoneypotHeuristic,
} from "@/lib/analysis/honeypot";
import {
  type LiquidityAnalysisResult,
  analyzeLiquidityRisk,
} from "@/lib/analysis/liquidity";

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

const ANALYZER_TIMEOUT_MS = 12_000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value);
}

function toFiniteNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeWarnings(warnings: string[]) {
  return Array.from(
    new Set(
      warnings
        .map((warning) => warning.trim())
        .filter((warning) => Boolean(warning)),
    ),
  );
}

function timeoutError(label: string, timeoutMs: number) {
  return new Error(`${label} timed out after ${timeoutMs}ms.`);
}

function withTimeout<T>(label: string, promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(timeoutError(label, timeoutMs));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unexpected analyzer error.";
}

async function runAnalyzer<T extends { warnings: string[] }>(
  label: string,
  run: () => Promise<T>,
  fallbackFactory: (errorMessage: string) => T,
): Promise<T> {
  try {
    const result = await withTimeout(label, run(), ANALYZER_TIMEOUT_MS);
    return {
      ...result,
      warnings: normalizeWarnings(result.warnings),
    };
  } catch (error) {
    return fallbackFactory(toErrorMessage(error));
  }
}

function defaultContractFallback(errorMessage: string): ContractAnalysisResult {
  return {
    contractName: "Unknown Contract",
    warnings: [`Contract analyzer fallback: ${errorMessage}`],
    risk: 40,
    confidence: 0.2,
    isVerified: false,
    isProxy: false,
    hasMintFunction: false,
    hasOwnerPrivileges: false,
  };
}

function defaultLiquidityFallback(errorMessage: string): LiquidityAnalysisResult {
  return {
    liquidityUsd: 0,
    warnings: [`Liquidity analyzer fallback: ${errorMessage}`],
    risk: 35,
    confidence: 0.2,
    hasPool: false,
  };
}

function defaultHolderFallback(errorMessage: string): HolderAnalysisResult {
  return {
    topHolderPercent: 0,
    top10HolderPercent: 0,
    warnings: [`Holder analyzer fallback: ${errorMessage}`],
    risk: 18,
    confidence: 0.2,
    provider: "none",
  };
}

function defaultHoneypotFallback(errorMessage: string): HoneypotAnalysisResult {
  return {
    warnings: [`Honeypot analyzer fallback: ${errorMessage}`],
    risk: 20,
    confidence: 0.25,
    heuristicTag: "heuristic",
    verdict: "unknown",
  };
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

  const [contractAnalysis, liquidityAnalysis, holderAnalysis] = await Promise.all([
    runAnalyzer("contract-analysis", () => analyzeContractRisk(address), defaultContractFallback),
    runAnalyzer("liquidity-analysis", () => analyzeLiquidityRisk(address), defaultLiquidityFallback),
    runAnalyzer("holder-analysis", () => analyzeHolderConcentration(address), defaultHolderFallback),
  ]);

  const honeypotAnalysis = await runAnalyzer(
    "honeypot-analysis",
    () =>
      analyzeHoneypotHeuristic({
        address,
        isProxy: contractAnalysis.isProxy,
        hasMintFunction: contractAnalysis.hasMintFunction,
        hasOwnerPrivileges: contractAnalysis.hasOwnerPrivileges,
        liquidityUsd: liquidityAnalysis.liquidityUsd,
      }),
    defaultHoneypotFallback,
  );

  const weights = {
    contract: 0.35,
    liquidity: 0.3,
    holders: 0.2,
    honeypot: 0.15,
  };

  const contractRisk = toFiniteNumber(contractAnalysis.risk, 100);
  const liquidityRisk = toFiniteNumber(liquidityAnalysis.risk, 100);
  const holderRisk = toFiniteNumber(holderAnalysis.risk, 100);
  const honeypotRisk = toFiniteNumber(honeypotAnalysis.risk, 100);

  const contractConfidence = clamp(toFiniteNumber(contractAnalysis.confidence, 0), 0, 1);
  const liquidityConfidence = clamp(toFiniteNumber(liquidityAnalysis.confidence, 0), 0, 1);
  const holderConfidence = clamp(toFiniteNumber(holderAnalysis.confidence, 0), 0, 1);
  const honeypotConfidence = clamp(toFiniteNumber(honeypotAnalysis.confidence, 0), 0, 1);

  const baseScore =
    contractRisk * weights.contract +
    liquidityRisk * weights.liquidity +
    holderRisk * weights.holders +
    honeypotRisk * weights.honeypot;

  const confidence = clamp(
    contractConfidence * weights.contract +
      liquidityConfidence * weights.liquidity +
      holderConfidence * weights.holders +
      honeypotConfidence * weights.honeypot,
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
    contract: contractAnalysis.contractName || "Unknown Contract",
    liquidity: Math.max(0, round(toFiniteNumber(liquidityAnalysis.liquidityUsd))),
    warnings: normalizeWarnings(warnings),
    topHolderPercent: Number(toFiniteNumber(holderAnalysis.topHolderPercent).toFixed(2)),
    top10HolderPercent: Number(toFiniteNumber(holderAnalysis.top10HolderPercent).toFixed(2)),
    breakdown: {
      contract: round(clamp(contractRisk, 0, 100)),
      liquidity: round(clamp(liquidityRisk, 0, 100)),
      holders: round(clamp(holderRisk, 0, 100)),
      honeypot: round(clamp(honeypotRisk, 0, 100)),
    },
    sources: {
      holdersProvider: holderAnalysis.provider,
      honeypotMethod: honeypotAnalysis.heuristicTag,
    },
  };
}
