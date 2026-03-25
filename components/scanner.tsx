"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { getAddress, isAddress } from "ethers";

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
  meta?: {
    requestId: string;
    analyzedAddress: string;
    generatedAt: string;
    durationMs: number;
    cache: "miss" | "hit" | "deduped" | "stale";
    stale: boolean;
  };
}

interface ScannerProps {
  onResult: (result: AnalysisResponse | null) => void;
}

const RECENT_SCANS_STORAGE_KEY = "rugshield:recent-scans";
const MAX_RECENT_SCANS = 6;
const EXAMPLE_ADDRESSES = [
  {
    label: "WETH",
    address: "0xC02aaA39B223FE8D0A0E5C4F27eAD9083C756Cc2",
  },
  {
    label: "USDC",
    address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  {
    label: "UNI",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  },
] as const;

function loadRecentScans(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SCANS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => Boolean(item))
      .slice(0, MAX_RECENT_SCANS);
  } catch {
    return [];
  }
}

function saveRecentScans(addresses: string[]) {
  try {
    window.localStorage.setItem(RECENT_SCANS_STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    // Ignore browser persistence errors (private mode/quota) without breaking scans.
  }
}

export function Scanner({ onResult }: ScannerProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const activeRequest = useRef<AbortController | null>(null);
  const activeRequestVersion = useRef(0);

  useEffect(() => {
    setRecentScans(loadRecentScans());

    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  const normalizeAddress = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    return isAddress(trimmed) ? getAddress(trimmed) : trimmed;
  };

  const clearRecentScans = () => {
    setRecentScans([]);
    saveRecentScans([]);
  };

  const handleScan = async (candidateAddress?: string) => {
    const scanAddress = normalizeAddress(candidateAddress ?? address);

    if (!scanAddress) {
      setError("Enter a token address to scan.");
      onResult(null);
      return;
    }

    if (!isAddress(scanAddress)) {
      setError("Enter a valid Ethereum token contract address.");
      onResult(null);
      return;
    }

    if (candidateAddress) {
      setAddress(scanAddress);
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    activeRequestVersion.current += 1;
    const requestVersion = activeRequestVersion.current;

    setError(null);
    setLoading(true);

    try {
      const { data } = await axios.post<AnalysisResponse>("/api/analyze", {
        address: scanAddress,
      }, {
        signal: controller.signal,
      });

      if (requestVersion !== activeRequestVersion.current) {
        return;
      }

      setRecentScans((previous) => {
        const next = [scanAddress, ...previous.filter((item) => item !== scanAddress)].slice(
          0,
          MAX_RECENT_SCANS,
        );
        saveRecentScans(next);
        return next;
      });

      onResult(data);
    } catch (requestError) {
      if (
        axios.isAxiosError(requestError) &&
        (requestError.code === "ERR_CANCELED" || requestError.message === "canceled")
      ) {
        return;
      }

      const message = axios.isAxiosError<{ error?: string }>(requestError)
        ? requestError.response?.data?.error || "Scan failed."
        : "Scan failed.";

      if (requestVersion !== activeRequestVersion.current) {
        return;
      }

      setError(message);
      onResult(null);
    } finally {
      if (requestVersion === activeRequestVersion.current) {
        setLoading(false);
      }
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
          onBlur={() => {
            setAddress((current) => normalizeAddress(current));
          }}
          onChange={(event) => {
            setAddress(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          className="h-11 bg-zinc-950"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={loading} className="h-11 min-w-36">
          {loading ? "Scanning..." : "Scan Token"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span>Examples:</span>
        {EXAMPLE_ADDRESSES.map((example) => (
          <button
            key={example.address}
            type="button"
            onClick={() => {
              setAddress(example.address);
              setError(null);
              void handleScan(example.address);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            {example.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400">
        Checks contract risk, liquidity depth, holder concentration, and honeypot behavior.
      </p>
      {error ? (
        <p className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {recentScans.length ? (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Recent Scans</p>
            <button
              type="button"
              onClick={clearRecentScans}
              className="text-xs text-zinc-500 transition hover:text-zinc-200"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentScans.map((recentAddress) => (
              <button
                key={recentAddress}
                type="button"
                onClick={() => {
                  setAddress(recentAddress);
                  setError(null);
                  void handleScan(recentAddress);
                }}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                {recentAddress}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
