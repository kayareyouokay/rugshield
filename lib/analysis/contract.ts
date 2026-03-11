import axios from "axios";

export interface ContractAnalysisResult {
  contractName: string;
  warnings: string[];
  risk: number;
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
  result: EtherscanSourceCodeItem[];
}

const OWNER_PRIVILEGE_HINTS = [
  "owner",
  "setowner",
  "transferownership",
  "renounceownership",
  "pause",
  "unpause",
  "setfee",
  "blacklist",
  "whitelist",
  "settax",
];

export async function analyzeContractRisk(
  address: string,
): Promise<ContractAnalysisResult> {
  const warnings: string[] = [];
  let risk = 0;

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    warnings.push("ETHERSCAN_API_KEY missing: contract analysis is using fallback assumptions.");
    return {
      contractName: "Unknown",
      warnings,
      risk: 15,
      isVerified: false,
      isProxy: false,
      hasMintFunction: false,
      hasOwnerPrivileges: false,
    };
  }

  try {
    const { data } = await axios.get<EtherscanResponse>(
      "https://api.etherscan.io/api",
      {
        params: {
          module: "contract",
          action: "getsourcecode",
          address,
          apikey: apiKey,
        },
      },
    );

    const result = data.result?.[0];
    if (!result) {
      warnings.push("Unable to load contract metadata from Etherscan.");
      return {
        contractName: "Unknown",
        warnings,
        risk: 20,
        isVerified: false,
        isProxy: false,
        hasMintFunction: false,
        hasOwnerPrivileges: false,
      };
    }

    const abiRaw = result.ABI ?? "";
    const isVerified =
      Boolean(result.SourceCode?.trim()) &&
      !abiRaw.toLowerCase().includes("not verified");

    if (!isVerified) {
      warnings.push("Contract source is unverified.");
      risk += 30;
    }

    const isProxy = result.Proxy === "1" || Boolean(result.Implementation?.trim());
    if (isProxy) {
      warnings.push("Upgradeable proxy detected.");
      risk += 15;
    }

    let abiItems: Array<{ type?: string; name?: string }> = [];
    if (abiRaw.startsWith("[")) {
      try {
        abiItems = JSON.parse(abiRaw) as Array<{ type?: string; name?: string }>;
      } catch {
        warnings.push("Failed to parse ABI from Etherscan.");
        risk += 5;
      }
    }

    const functionNames = abiItems
      .filter((item) => item.type === "function" && item.name)
      .map((item) => item.name!.toLowerCase());

    const hasMintFunction = functionNames.some((name) => name.includes("mint"));
    if (hasMintFunction) {
      warnings.push("Mint-related function detected.");
      risk += 15;
    }

    const hasOwnerPrivileges = functionNames.some((name) =>
      OWNER_PRIVILEGE_HINTS.some((hint) => name.includes(hint)),
    );

    if (hasOwnerPrivileges) {
      warnings.push("Owner privilege functions detected.");
      risk += 15;
    }

    return {
      contractName: result.ContractName || "Unknown",
      warnings,
      risk,
      isVerified,
      isProxy,
      hasMintFunction,
      hasOwnerPrivileges,
    };
  } catch {
    warnings.push("Etherscan lookup failed.");
    return {
      contractName: "Unknown",
      warnings,
      risk: 20,
      isVerified: false,
      isProxy: false,
      hasMintFunction: false,
      hasOwnerPrivileges: false,
    };
  }
}
