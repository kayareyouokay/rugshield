import { Contract } from "ethers";

import { getJson } from "@/lib/http";
import { getEthereumProvider } from "@/lib/provider";

export interface ContractAnalysisResult {
  contractName: string;
  warnings: string[];
  risk: number;
  confidence: number;
  isVerified: boolean;
  isProxy: boolean;
  hasMintFunction: boolean;
  hasOwnerPrivileges: boolean;
}

interface EtherscanSourceCodeItem {
  ContractName: string;
  SourceCode: string;
  ABI: string;
  Proxy: "0" | "1";
  Implementation: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanSourceCodeItem[] | string;
}

interface OnchainMetadata {
  isContract: boolean;
  tokenName: string;
  symbol: string;
  error?: string;
}

const ERC20_METADATA_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
] as const;

const OWNER_PRIVILEGE_HINTS = [
  "owner",
  "setowner",
  "transferownership",
  "renounceownership",
  "pause",
  "unpause",
  "setfee",
  "settax",
  "blacklist",
  "whitelist",
  "exclude",
  "setmax",
  "setlimit",
  "setrouter",
];

const SOURCE_PRIVILEGE_HINTS = [
  "onlyowner",
  "_owner",
  "tradingenabled",
  "settrading",
  "maxwallet",
  "maxtransaction",
  "blacklist",
  "settax",
];

const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampConfidence(value: number) {
  return Math.max(0.1, Math.min(1, Number(value.toFixed(2))));
}

function parseAbiItems(
  abiRaw: string,
): { parsed: boolean; items: Array<{ type?: string; name?: string }> } {
  let candidate: unknown = abiRaw.trim();

  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(candidate)) {
      return { parsed: true, items: candidate as Array<{ type?: string; name?: string }> };
    }

    if (
      typeof candidate === "object" &&
      candidate &&
      "abi" in candidate &&
      Array.isArray((candidate as { abi?: unknown }).abi)
    ) {
      return {
        parsed: true,
        items: (candidate as { abi: Array<{ type?: string; name?: string }> }).abi,
      };
    }

    if (typeof candidate !== "string") {
      break;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      break;
    }

    if (!["[", "{", "\""].includes(trimmed[0])) {
      break;
    }

    try {
      candidate = JSON.parse(trimmed);
    } catch {
      break;
    }
  }

  return { parsed: false, items: [] };
}

function extractFunctionNamesFromAbi(
  abiRaw: string,
): { parsed: boolean; functionNames: string[] } {
  const parsedAbi = parseAbiItems(abiRaw);

  if (!parsedAbi.parsed) {
    return { parsed: false, functionNames: [] };
  }

  const functionNames = parsedAbi.items
    .filter((item) => item.type === "function" && typeof item.name === "string")
    .map((item) => item.name!.toLowerCase());

  return {
    parsed: true,
    functionNames,
  };
}

function sourceHasPrivilegeHints(sourceCode: string) {
  if (!sourceCode.trim()) {
    return false;
  }

  const normalized = sourceCode.toLowerCase();
  return SOURCE_PRIVILEGE_HINTS.some((hint) => normalized.includes(hint));
}

async function readOnchainMetadata(address: string): Promise<OnchainMetadata> {
  const provider = getEthereumProvider();

  try {
    const code = await provider.getCode(address);
    if (!code || code === "0x") {
      return {
        isContract: false,
        tokenName: "",
        symbol: "",
      };
    }

    const contract = new Contract(address, ERC20_METADATA_ABI, provider);

    const [nameResult, symbolResult] = await Promise.allSettled([
      contract.name(),
      contract.symbol(),
    ]);

    const tokenName =
      nameResult.status === "fulfilled" && typeof nameResult.value === "string"
        ? nameResult.value.trim()
        : "";

    const symbol =
      symbolResult.status === "fulfilled" && typeof symbolResult.value === "string"
        ? symbolResult.value.trim()
        : "";

    return {
      isContract: true,
      tokenName,
      symbol,
    };
  } catch (error) {
    return {
      isContract: true,
      tokenName: "",
      symbol: "",
      error: error instanceof Error ? error.message : "RPC metadata lookup failed.",
    };
  }
}

async function detectProxyViaStorage(address: string): Promise<boolean | null> {
  try {
    const provider = getEthereumProvider();
    const value = await provider.getStorage(address, EIP1967_IMPLEMENTATION_SLOT);
    if (!value) {
      return null;
    }

    return !/^0x0+$/i.test(value);
  } catch {
    return null;
  }
}

export async function analyzeContractRisk(
  address: string,
): Promise<ContractAnalysisResult> {
  const warnings: string[] = [];
  let risk = 0;
  let confidence = 0.35;

  const onchain = await readOnchainMetadata(address);

  if (!onchain.isContract) {
    return {
      contractName: "Not a Contract",
      warnings: ["No smart contract bytecode found at this address."],
      risk: 100,
      confidence: 0.95,
      isVerified: false,
      isProxy: false,
      hasMintFunction: false,
      hasOwnerPrivileges: false,
    };
  }

  if (onchain.error) {
    warnings.push("Unable to read token metadata from RPC provider.");
    risk += 8;
    confidence -= 0.08;
  } else {
    confidence += 0.15;
  }

  const inferredName =
    onchain.tokenName || (onchain.symbol ? `${onchain.symbol} Token` : "Unknown Contract");

  if (!onchain.tokenName && !onchain.symbol) {
    warnings.push("Token does not expose ERC-20 name/symbol metadata.");
    risk += 10;
  }

  let isProxy = false;
  let hasMintFunction = false;
  let hasOwnerPrivileges = false;
  let isVerified = false;

  const apiKey = process.env.ETHERSCAN_API_KEY?.trim();
  if (!apiKey) {
    warnings.push("ETHERSCAN_API_KEY missing: source verification checks are limited.");
    risk += 6;
    confidence -= 0.1;

    const proxyViaStorage = await detectProxyViaStorage(address);
    if (proxyViaStorage) {
      isProxy = true;
      warnings.push("Upgradeable proxy storage slot detected.");
      risk += 12;
      confidence += 0.05;
    }

    return {
      contractName: inferredName,
      warnings,
      risk: clampRisk(risk),
      confidence: clampConfidence(confidence),
      isVerified,
      isProxy,
      hasMintFunction,
      hasOwnerPrivileges,
    };
  }

  const etherscanChainId = process.env.ETHERSCAN_CHAIN_ID?.trim() || "1";

  const etherscan = await getJson<EtherscanResponse>({
    source: "Etherscan",
    url: "https://api.etherscan.io/v2/api",
    params: {
      chainid: etherscanChainId,
      module: "contract",
      action: "getsourcecode",
      address,
      apikey: apiKey,
    },
    retries: 2,
    timeoutMs: 8_000,
  });

  if (!etherscan.ok) {
    warnings.push(`Etherscan lookup failed: ${etherscan.error}`);
    risk += 8;
    confidence -= 0.12;

    const proxyViaStorage = await detectProxyViaStorage(address);
    if (proxyViaStorage) {
      isProxy = true;
      warnings.push("Upgradeable proxy storage slot detected.");
      risk += 12;
      confidence += 0.05;
    }

    return {
      contractName: inferredName,
      warnings,
      risk: clampRisk(risk),
      confidence: clampConfidence(confidence),
      isVerified,
      isProxy,
      hasMintFunction,
      hasOwnerPrivileges,
    };
  }

  const responseResult = etherscan.data.result;
  const metadata = Array.isArray(responseResult) ? responseResult[0] : undefined;

  if (!metadata) {
    const responseText = typeof responseResult === "string" ? responseResult : "";
    const isDeprecatedV1Error = responseText.toLowerCase().includes("deprecated v1 endpoint");

    warnings.push(
      responseText
        ? `Etherscan response: ${responseText}`
        : "Etherscan did not return contract metadata.",
    );
    risk += isDeprecatedV1Error ? 4 : 10;
    confidence -= isDeprecatedV1Error ? 0.04 : 0.1;

    return {
      contractName: inferredName,
      warnings,
      risk: clampRisk(risk),
      confidence: clampConfidence(confidence),
      isVerified,
      isProxy,
      hasMintFunction,
      hasOwnerPrivileges,
    };
  }

  confidence += 0.45;
  const abiRaw = (metadata.ABI || "").trim();
  const sourceCode = metadata.SourceCode || "";

  isVerified = Boolean(sourceCode.trim()) && !abiRaw.toLowerCase().includes("not verified");

  if (!isVerified) {
    warnings.push("Contract source code is unverified on Etherscan.");
    risk += 24;
    confidence -= 0.15;
  }

  const abiAnalysis = extractFunctionNamesFromAbi(abiRaw);
  const functionNames = abiAnalysis.functionNames;

  if (!abiAnalysis.parsed && isVerified) {
    warnings.push("Verified contract ABI was not parsable.");
    risk += 6;
    confidence -= 0.05;
  }

  hasMintFunction = functionNames.some(
    (name) => name.includes("mint") || name.includes("rebase"),
  );

  if (hasMintFunction) {
    warnings.push("Mint or supply-expansion function detected.");
    risk += 14;
  }

  const ownerFunctionHit = functionNames.some((name) =>
    OWNER_PRIVILEGE_HINTS.some((hint) => name.includes(hint)),
  );
  const sourcePrivilegeHit = sourceHasPrivilegeHints(sourceCode);

  hasOwnerPrivileges = ownerFunctionHit || sourcePrivilegeHit;

  if (hasOwnerPrivileges) {
    warnings.push("Owner-controlled administrative functions detected.");
    risk += 14;
  }

  isProxy = metadata.Proxy === "1" || Boolean(metadata.Implementation?.trim());

  if (!isProxy) {
    const proxyViaStorage = await detectProxyViaStorage(address);
    isProxy = Boolean(proxyViaStorage);
  }

  if (isProxy) {
    warnings.push("Upgradeable proxy behavior detected.");
    risk += 12;
  }

  return {
    contractName: metadata.ContractName?.trim() || inferredName,
    warnings,
    risk: clampRisk(risk),
    confidence: clampConfidence(confidence),
    isVerified,
    isProxy,
    hasMintFunction,
    hasOwnerPrivileges,
  };
}
