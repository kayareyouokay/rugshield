import { getJson } from "@/lib/http";

export interface HolderAnalysisResult {
  topHolderPercent: number;
  top10HolderPercent: number;
  warnings: string[];
  risk: number;
  confidence: number;
  provider: "covalent" | "ethplorer" | "none";
}

interface CovalentHolderItem {
  balance?: string;
  total_supply?: string;
}

interface CovalentResponse {
  data?: {
    items?: CovalentHolderItem[];
  };
  error?: boolean;
  error_message?: string;
}

interface EthplorerHolder {
  share?: number;
}

interface EthplorerResponse {
  holders?: EthplorerHolder[];
}

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function percentOf(part: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(part) || part < 0) {
    return 0;
  }

  return (part / total) * 100;
}

function scoreConcentration(top1: number, top10: number) {
  let risk = 0;
  const warnings: string[] = [];

  if (top1 >= 60) {
    warnings.push("Top holder concentration exceeds 60%.");
    risk += 35;
  } else if (top1 >= 40) {
    warnings.push("Top holder concentration exceeds 40%.");
    risk += 24;
  } else if (top1 >= 25) {
    warnings.push("Top holder concentration exceeds 25%.");
    risk += 14;
  } else if (top1 >= 15) {
    warnings.push("Top holder concentration exceeds 15%.");
    risk += 6;
  }

  if (top10 >= 90) {
    warnings.push("Top 10 holders control over 90% of supply.");
    risk += 16;
  } else if (top10 >= 75) {
    warnings.push("Top 10 holders control over 75% of supply.");
    risk += 10;
  }

  return {
    risk: clampRisk(risk),
    warnings,
  };
}

async function fetchFromCovalent(
  address: string,
  apiKey: string,
): Promise<{ top1: number; top10: number } | { error: string } | null> {
  const chainName = process.env.COVALENT_CHAIN_NAME?.trim() || "eth-mainnet";

  const response = await getJson<CovalentResponse>({
    source: "Covalent",
    url: `https://api.covalenthq.com/v1/${chainName}/tokens/${address}/token_holders_v2/`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    params: {
      key: apiKey,
      "page-size": 100,
      "page-number": 0,
    },
    timeoutMs: 8_000,
    retries: 2,
  });

  if (!response.ok) {
    return { error: response.error };
  }

  if (response.data.error) {
    return {
      error: response.data.error_message || "Covalent returned an application-level error.",
    };
  }

  const items = response.data.data?.items ?? [];
  if (!items.length) {
    return { error: "Covalent returned an empty holder list." };
  }

  const totalSupplyCandidate = items
    .map((item) => toNumber(item.total_supply))
    .find((value) => typeof value === "number" && value > 0);
  const totalSupply = totalSupplyCandidate ?? null;
  if (!totalSupply || totalSupply <= 0) {
    return { error: "Covalent returned holders without a readable total supply." };
  }

  const balances = items
    .map((item) => toNumber(item.balance) ?? 0)
    .filter((balance) => balance > 0);

  if (!balances.length) {
    return { error: "Covalent returned holder rows without readable balances." };
  }

  const top1 = percentOf(balances[0], totalSupply);
  const top10Balance = balances.slice(0, 10).reduce((sum, current) => sum + current, 0);
  const top10 = percentOf(top10Balance, totalSupply);

  return {
    top1,
    top10,
  };
}

async function fetchFromEthplorer(
  address: string,
): Promise<{ top1: number; top10: number } | null> {
  const apiKey = process.env.ETHPLORER_API_KEY?.trim() || "freekey";

  const response = await getJson<EthplorerResponse>({
    source: "Ethplorer",
    url: `https://api.ethplorer.io/getTopTokenHolders/${address}`,
    params: {
      apiKey,
      limit: 10,
    },
    timeoutMs: 8_000,
    retries: 2,
  });

  if (!response.ok) {
    return null;
  }

  const shares = (response.data.holders ?? [])
    .map((holder) => Number(holder.share ?? 0))
    .filter((share) => Number.isFinite(share) && share > 0);

  if (!shares.length) {
    return null;
  }

  const top1 = shares[0] ?? 0;
  const top10 = shares.reduce((sum, value) => sum + value, 0);

  return {
    top1,
    top10,
  };
}

export async function analyzeHolderConcentration(
  address: string,
): Promise<HolderAnalysisResult> {
  const warnings: string[] = [];
  const covalentApiKey = process.env.COVALENT_API_KEY?.trim();

  if (covalentApiKey) {
    const covalent = await fetchFromCovalent(address, covalentApiKey);
    if (covalent && !("error" in covalent)) {
      const score = scoreConcentration(covalent.top1, covalent.top10);
      return {
        topHolderPercent: covalent.top1,
        top10HolderPercent: covalent.top10,
        warnings: score.warnings,
        risk: score.risk,
        confidence: 0.92,
        provider: "covalent",
      };
    }

    warnings.push(
      `Covalent holder query failed${
        covalent && "error" in covalent ? `: ${covalent.error}` : ""
      }; using Ethplorer fallback.`,
    );
  }

  const ethplorer = await fetchFromEthplorer(address);
  if (ethplorer) {
    const score = scoreConcentration(ethplorer.top1, ethplorer.top10);

    return {
      topHolderPercent: ethplorer.top1,
      top10HolderPercent: ethplorer.top10,
      warnings: score.warnings.length ? warnings.concat(score.warnings) : warnings,
      risk: score.risk,
      confidence: 0.85,
      provider: "ethplorer",
    };
  }

  warnings.push("Unable to fetch holder concentration from Covalent or Ethplorer.");

  return {
    topHolderPercent: 0,
    top10HolderPercent: 0,
    warnings,
    risk: 18,
    confidence: 0.2,
    provider: "none",
  };
}
