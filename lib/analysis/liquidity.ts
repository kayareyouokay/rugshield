import { getJson } from "@/lib/http";

export interface LiquidityAnalysisResult {
  liquidityUsd: number;
  warnings: string[];
  risk: number;
  confidence: number;
  hasPool: boolean;
}

interface DexscreenerPair {
  chainId?: string;
  liquidity?: {
    usd?: number;
  };
  volume?: {
    h24?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

interface DexscreenerResponse {
  pairs: DexscreenerPair[] | null;
}

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function analyzeLiquidityRisk(
  address: string,
): Promise<LiquidityAnalysisResult> {
  const warnings: string[] = [];

  const response = await getJson<DexscreenerResponse>({
    source: "Dexscreener",
    url: `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    timeoutMs: 8_000,
    retries: 2,
  });

  if (!response.ok) {
    warnings.push(`Failed to fetch liquidity data: ${response.error}`);
    return {
      liquidityUsd: 0,
      warnings,
      risk: 35,
      confidence: 0.2,
      hasPool: false,
    };
  }

  const allPairs = response.data.pairs ?? [];
  if (!allPairs.length) {
    warnings.push("No liquidity pool was found for this token.");
    return {
      liquidityUsd: 0,
      warnings,
      risk: 55,
      confidence: 0.9,
      hasPool: false,
    };
  }

  const ethereumPairs = allPairs.filter((pair) => pair.chainId === "ethereum");
  const candidatePairs = ethereumPairs.length ? ethereumPairs : allPairs;

  const bestPair = candidatePairs.reduce((currentBest, pair) => {
    const currentLiquidity = Number(currentBest?.liquidity?.usd ?? 0);
    const nextLiquidity = Number(pair.liquidity?.usd ?? 0);
    return nextLiquidity > currentLiquidity ? pair : currentBest;
  }, candidatePairs[0]);

  const liquidityUsd = Number(bestPair?.liquidity?.usd ?? 0);
  const volume24h = Number(bestPair?.volume?.h24 ?? 0);
  const fdv = Number(bestPair?.fdv ?? 0);

  let risk = 0;

  if (!Number.isFinite(liquidityUsd) || liquidityUsd <= 0) {
    warnings.push("Active liquidity pool exists but has no readable USD liquidity.");
    risk += 45;
  } else if (liquidityUsd < 25_000) {
    warnings.push("Liquidity is below $25,000 (high slippage/rug risk)." );
    risk += 38;
  } else if (liquidityUsd < 100_000) {
    warnings.push("Liquidity is below $100,000.");
    risk += 25;
  } else if (liquidityUsd < 500_000) {
    warnings.push("Liquidity is below $500,000.");
    risk += 12;
  } else {
    risk += 3;
  }

  if (Number.isFinite(volume24h) && volume24h < 5_000) {
    warnings.push("24h trading volume is very low.");
    risk += 10;
  }

  if (Number.isFinite(fdv) && fdv > 0 && Number.isFinite(liquidityUsd) && liquidityUsd > 0) {
    const liquidityToFdv = liquidityUsd / fdv;
    if (liquidityToFdv < 0.01) {
      warnings.push("Liquidity-to-FDV ratio is under 1%.");
      risk += 10;
    } else if (liquidityToFdv < 0.03) {
      warnings.push("Liquidity-to-FDV ratio is under 3%.");
      risk += 5;
    }
  }

  if (allPairs.length > 12) {
    warnings.push("Token is spread across many pools; liquidity may be fragmented.");
    risk += 4;
  }

  return {
    liquidityUsd: Number.isFinite(liquidityUsd) ? Math.max(0, liquidityUsd) : 0,
    warnings,
    risk: clampRisk(risk),
    confidence: 0.95,
    hasPool: true,
  };
}
