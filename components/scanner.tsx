"use client";

import { useState } from "react";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AnalysisResponse {
  score: number;
  contract: string;
  liquidity: number;
  warnings: string[];
  topHolderPercent?: number;
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Paste ERC-20 token address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Button onClick={handleScan} disabled={loading} className="sm:w-32">
          {loading ? "Scanning..." : "Scan"}
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
