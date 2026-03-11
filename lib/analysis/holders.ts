import axios from "axios";

export interface HolderAnalysisResult {
  topHolderPercent: number;
  warnings: string[];
  risk: number;
}

interface EthplorerHolder {
  share?: number;
}

interface EthplorerResponse {
  holders?: EthplorerHolder[];
}

export async function analyzeHolderConcentration(
  address: string,
): Promise<HolderAnalysisResult> {
  const warnings: string[] = [];
  let risk = 0;

  const apiKey = process.env.ETHPLORER_API_KEY || process.env.COVALENT_API_KEY || "freekey";

  try {
    const { data } = await axios.get<EthplorerResponse>(
      `https://api.ethplorer.io/getTopTokenHolders/${address}`,
      {
        params: {
          apiKey,
          limit: 10,
        },
      },
    );

    const topShare = Number(data.holders?.[0]?.share ?? 0);
    const topHolderPercent = Number.isFinite(topShare) ? topShare : 0;

    if (topHolderPercent > 40) {
      warnings.push("Top holder concentration exceeds 40%.");
      risk += 20;
    }

    return {
      topHolderPercent,
      warnings,
      risk,
    };
  } catch {
    warnings.push("Failed to fetch holder concentration from Ethplorer.");
    return {
      topHolderPercent: 0,
      warnings,
      risk: 10,
    };
  }
}
