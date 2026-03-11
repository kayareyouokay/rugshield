export interface HoneypotHeuristicInput {
  isProxy: boolean;
  hasMintFunction: boolean;
  hasOwnerPrivileges: boolean;
  liquidityUsd: number;
}

export interface HoneypotAnalysisResult {
  warnings: string[];
  risk: number;
  heuristicTag: "placeholder" | "suspicious-pattern";
}

export async function analyzeHoneypotHeuristic(
  input: HoneypotHeuristicInput,
): Promise<HoneypotAnalysisResult> {
  const warnings: string[] = [];

  const suspiciousPattern =
    input.hasOwnerPrivileges && input.hasMintFunction && input.liquidityUsd < 100_000;

  if (suspiciousPattern) {
    warnings.push("Placeholder heuristic: token has patterns often seen in honeypot setups.");
    return {
      warnings,
      risk: 10,
      heuristicTag: "suspicious-pattern",
    };
  }

  return {
    warnings,
    risk: 0,
    heuristicTag: "placeholder",
  };
}
