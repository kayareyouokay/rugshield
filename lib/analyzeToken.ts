import { isAddress } from "ethers";

import { analyzeContractRisk } from "@/lib/analysis/contract";
import { analyzeHolderConcentration } from "@/lib/analysis/holders";
import { analyzeHoneypotHeuristic } from "@/lib/analysis/honeypot";
import { analyzeLiquidityRisk } from "@/lib/analysis/liquidity";

export interface AnalyzeTokenResult {
  score: number;
  contract: string;
  liquidity: number;
  warnings: string[];
  topHolderPercent: number;
}

export async function analyzeToken(address: string): Promise<AnalyzeTokenResult> {
  if (!isAddress(address)) {
    return {
      score: 100,
      contract: "Invalid Address",
      liquidity: 0,
      warnings: ["Provided token address is not a valid ERC-20 address."],
      topHolderPercent: 0,
    };
  }

  const [contractAnalysis, liquidityAnalysis, holderAnalysis] = await Promise.all([
    analyzeContractRisk(address),
    analyzeLiquidityRisk(address),
    analyzeHolderConcentration(address),
  ]);

  const honeypotAnalysis = await analyzeHoneypotHeuristic({
    isProxy: contractAnalysis.isProxy,
    hasMintFunction: contractAnalysis.hasMintFunction,
    hasOwnerPrivileges: contractAnalysis.hasOwnerPrivileges,
    liquidityUsd: liquidityAnalysis.liquidityUsd,
  });

  const totalRisk = Math.min(
    100,
    contractAnalysis.risk +
      liquidityAnalysis.risk +
      holderAnalysis.risk +
      honeypotAnalysis.risk,
  );

  const warnings = [
    ...contractAnalysis.warnings,
    ...liquidityAnalysis.warnings,
    ...holderAnalysis.warnings,
    ...honeypotAnalysis.warnings,
  ];

  return {
    score: totalRisk,
    contract: contractAnalysis.contractName,
    liquidity: liquidityAnalysis.liquidityUsd,
    warnings: Array.from(new Set(warnings)),
    topHolderPercent: holderAnalysis.topHolderPercent,
  };
}
