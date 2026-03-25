"use client";

import { useEffect, useState } from "react";
import { Clock3, ShieldAlert, Trash2 } from "lucide-react";

import type { AnalysisResponse } from "@/components/scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRiskBadgeClass, getRiskLabel } from "@/lib/risk";

interface HistoryPanelProps {
  latestResult: AnalysisResponse | null;
}

interface ScanHistoryEntry {
  address: string;
  contract: string;
  score: number;
  confidence: number | null;
  liquidity: number;
  topHolderPercent: number | null;
  generatedAt: string;
  cache: string | null;
}

const SCAN_HISTORY_STORAGE_KEY = "rugshield:scan-history";
const MAX_SCAN_HISTORY = 5;

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ScanHistoryEntry[]) {
  try {
    window.localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore local storage failures without affecting the scan flow.
  }
}

function formatLiquidity(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export function HistoryPanel({ latestResult }: HistoryPanelProps) {
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!latestResult?.meta?.analyzedAddress) {
      return;
    }

    const nextEntry: ScanHistoryEntry = {
      address: latestResult.meta.analyzedAddress,
      contract: latestResult.contract || "Unknown Contract",
      score: latestResult.score,
      confidence: typeof latestResult.confidence === "number" ? latestResult.confidence : null,
      liquidity: latestResult.liquidity,
      topHolderPercent:
        typeof latestResult.topHolderPercent === "number" ? latestResult.topHolderPercent : null,
      generatedAt: latestResult.meta.generatedAt,
      cache: latestResult.meta.cache ?? null,
    };

    setHistory((current) => {
      const deduped = current.filter((entry) => entry.address !== nextEntry.address);
      const next = [nextEntry, ...deduped].slice(0, MAX_SCAN_HISTORY);
      saveHistory(next);
      return next;
    });
  }, [latestResult]);

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  if (!history.length) {
    return (
      <Card className="animate-rise-in [animation-delay:120ms]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Clock3 className="h-5 w-5 text-zinc-300" />
            Scan History
          </CardTitle>
          <CardDescription>Recent scans will appear here for quick comparison.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="animate-rise-in [animation-delay:120ms]">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Clock3 className="h-5 w-5 text-zinc-300" />
              Scan History
            </CardTitle>
            <CardDescription>Recent local scan snapshots for side-by-side risk context.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearHistory}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.address}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <ShieldAlert className="h-4 w-4 text-zinc-400" />
                  <span className="truncate">{entry.contract}</span>
                </p>
                <p className="mt-1 break-all text-xs text-zinc-500">{entry.address}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getRiskBadgeClass(entry.score)}`}
              >
                {getRiskLabel(entry.score)} {entry.score}/100
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-zinc-400 sm:grid-cols-4">
              <p>
                Liquidity
                <span className="mt-1 block text-sm text-zinc-200">{formatLiquidity(entry.liquidity)}</span>
              </p>
              <p>
                Top holder
                <span className="mt-1 block text-sm text-zinc-200">
                  {entry.topHolderPercent === null ? "--" : `${entry.topHolderPercent.toFixed(2)}%`}
                </span>
              </p>
              <p>
                Confidence
                <span className="mt-1 block text-sm text-zinc-200">
                  {entry.confidence === null ? "--" : `${Math.round(entry.confidence * 100)}%`}
                </span>
              </p>
              <p>
                Generated
                <span className="mt-1 block text-sm text-zinc-200">
                  {new Date(entry.generatedAt).toLocaleString()}
                </span>
              </p>
            </div>
            {entry.cache ? (
              <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">
                Cache state: {entry.cache}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
