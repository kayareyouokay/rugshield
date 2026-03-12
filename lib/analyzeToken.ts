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
    analyzeContractRisk(address),
    analyzeLiquidityRisk(address),
    analyzeHolderConcentration(address),
  ]);

  const honeypotAnalysis = await analyzeHoneypotHeuristic({
    address,
    isProxy: contractAnalysis.isProxy,
    hasMintFunction: contractAnalysis.hasMintFunction,
    hasOwnerPrivileges: contractAnalysis.hasOwnerPrivileges,
    liquidityUsd: liquidityAnalysis.liquidityUsd,
  });

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
