"use client";

import { useState } from "react";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AnalysisResponse {
  score: number;
  confidence?: number;
  contract: string;
  liquidity: number;
  warnings: string[];
  topHolderPercent?: number;
  top10HolderPercent?: number;
  breakdown?: {
    contract: number;
    liquidity: number;
    holders: number;
    honeypot: number;
  };
  sources?: {
    holdersProvider: string;
    honeypotMethod: string;
  };
}

interface ScannerProps {
  onResult: (result: AnalysisResponse | null) => void;
}

export function Scanner({ onResult }: ScannerProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!address.trim()) {
      setError("Enter a token address to scan.");
      onResult(null);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data } = await axios.post<AnalysisResponse>("/api/analyze", {
        address: address.trim(),
      });
      onResult(data);
    } catch (requestError) {
      const message = axios.isAxiosError<{ error?: string }>(requestError)
        ? requestError.response?.data?.error || "Scan failed."
        : "Scan failed.";
      setError(message);
      onResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void handleScan();
        }}
      >
        <Input
          placeholder="Paste ERC-20 token contract (0x...)"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="h-11 bg-zinc-950"
        />
        <Button
          type="submit"
          disabled={loading}
          className="h-11 min-w-36"
        >
          {loading ? "Scanning..." : "Scan Token"}
        </Button>
      </form>
      <p className="text-xs text-zinc-400">
        Checks contract risk, liquidity depth, holder concentration, and honeypot behavior.
      </p>
      {error ? (
        <p className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
