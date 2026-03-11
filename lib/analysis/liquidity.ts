import axios from "axios";

export interface LiquidityAnalysisResult {
  liquidityUsd: number;
  warnings: string[];
  risk: number;
  hasPool: boolean;
}

interface DexscreenerPair {
  liquidity?: {
    usd?: number;
  };
}

interface DexscreenerResponse {
  pairs: DexscreenerPair[] | null;
}

export async function analyzeLiquidityRisk(
  address: string,
): Promise<LiquidityAnalysisResult> {
  const warnings: string[] = [];
  let risk = 0;

  try {
    const { data } = await axios.get<DexscreenerResponse>(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    );

    const pairs = data.pairs ?? [];
    if (!pairs.length) {
      warnings.push("No liquidity pool found on Dexscreener.");
      return {
        liquidityUsd: 0,
        warnings,
        risk: 35,
        hasPool: false,
      };
    }

    const bestLiquidity = pairs.reduce((max, pair) => {
      const usd = Number(pair.liquidity?.usd ?? 0);
      return Math.max(max, Number.isFinite(usd) ? usd : 0);
    }, 0);

    if (bestLiquidity < 50_000) {
      warnings.push("Liquidity is below $50,000.");
      risk += 25;
    }

    return {
      liquidityUsd: bestLiquidity,
      warnings,
      risk,
      hasPool: true,
    };
  } catch {
    warnings.push("Failed to fetch liquidity data from Dexscreener.");
    return {
      liquidityUsd: 0,
      warnings,
      risk: 15,
      hasPool: false,
    };
  }
}
