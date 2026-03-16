import { getAddress, isAddress } from "ethers";
import { NextResponse } from "next/server";

import { type AnalyzeTokenResult, analyzeToken } from "@/lib/analyzeToken";

interface AnalyzeRequestBody {
  address?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface CachedAnalysisEntry {
  result: AnalyzeTokenResult;
  expiresAt: number;
  staleUntil: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 45;
const ANALYSIS_CACHE_TTL_MS = 45_000;
const ANALYSIS_CACHE_STALE_MS = 5 * 60_000;

const globalState = globalThis as typeof globalThis & {
  __rugshieldRateLimitStore?: Map<string, RateLimitEntry>;
  __rugshieldAnalysisCache?: Map<string, CachedAnalysisEntry>;
  __rugshieldInFlightAnalysis?: Map<string, Promise<AnalyzeTokenResult>>;
};

const rateLimitStore =
  globalState.__rugshieldRateLimitStore ??
  (globalState.__rugshieldRateLimitStore = new Map<string, RateLimitEntry>());

const analysisCache =
  globalState.__rugshieldAnalysisCache ??
  (globalState.__rugshieldAnalysisCache = new Map<string, CachedAnalysisEntry>());

const inFlightAnalysis =
  globalState.__rugshieldInFlightAnalysis ??
  (globalState.__rugshieldInFlightAnalysis = new Map<string, Promise<AnalyzeTokenResult>>());

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 100) || "unknown";
  return `ua:${userAgent}`;
}

function isRateLimited(clientId: string) {
  const now = Date.now();

  if (rateLimitStore.size) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }

  const current = rateLimitStore.get(clientId);

  if (!current || now >= current.resetAt) {
    rateLimitStore.set(clientId, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return false;
  }

  current.count += 1;

  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    rateLimitStore.set(clientId, current);
    return true;
  }

  rateLimitStore.set(clientId, current);
  return false;
}

function secondsUntilReset(clientId: string) {
  const resetAt = rateLimitStore.get(clientId)?.resetAt ?? Date.now() + WINDOW_MS;
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
}

function cleanupAnalysisCache(now: number) {
  if (!analysisCache.size) {
    return;
  }

  for (const [key, entry] of analysisCache.entries()) {
    if (entry.staleUntil <= now) {
      analysisCache.delete(key);
    }
  }
}

function getFreshCachedResult(address: string) {
  const cached = analysisCache.get(address);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt > Date.now()) {
    return cached.result;
  }

  return null;
}

function getStaleCachedResult(address: string) {
  const cached = analysisCache.get(address);
  if (!cached) {
    return null;
  }

  if (cached.staleUntil > Date.now()) {
    return cached.result;
  }

  return null;
}

async function getOrCreateAnalysis(address: string) {
  const cached = getFreshCachedResult(address);
  if (cached) {
    return {
      result: cached,
      cacheState: "hit" as const,
    };
  }

  const existing = inFlightAnalysis.get(address);
  if (existing) {
    const result = await existing;
    return {
      result,
      cacheState: "deduped" as const,
    };
  }

  const analysisPromise = analyzeToken(address)
    .then((result) => {
      const now = Date.now();
      analysisCache.set(address, {
        result,
        expiresAt: now + ANALYSIS_CACHE_TTL_MS,
        staleUntil: now + ANALYSIS_CACHE_STALE_MS,
      });
      return result;
    })
    .finally(() => {
      inFlightAnalysis.delete(address);
    });

  inFlightAnalysis.set(address, analysisPromise);

  const result = await analysisPromise;
  return {
    result,
    cacheState: "miss" as const,
  };
}

function withRequestIdHeaders(
  requestId: string,
  extras?: Record<string, string>,
): Record<string, string> {
  return {
    "x-rugshield-request-id": requestId,
    ...extras,
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  cleanupAnalysisCache(Date.now());

  const clientId = getClientIdentifier(request);

  if (isRateLimited(clientId)) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a minute and try again.",
      },
      {
        status: 429,
        headers: withRequestIdHeaders(requestId, {
          "Retry-After": String(secondsUntilReset(clientId)),
          "Cache-Control": "no-store",
        }),
      },
    );
  }

  let body: AnalyzeRequestBody;

  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      {
        status: 400,
        headers: withRequestIdHeaders(requestId, {
          "Cache-Control": "no-store",
        }),
      },
    );
  }

  const address = body.address?.trim();

  if (!address) {
    return NextResponse.json(
      { error: "Token address is required." },
      {
        status: 400,
        headers: withRequestIdHeaders(requestId, {
          "Cache-Control": "no-store",
        }),
      },
    );
  }

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Provided token address is not a valid EVM address." },
      {
        status: 400,
        headers: withRequestIdHeaders(requestId, {
          "Cache-Control": "no-store",
        }),
      },
    );
  }

  try {
    const normalizedAddress = getAddress(address);
    const { result, cacheState } = await getOrCreateAnalysis(normalizedAddress);

    return NextResponse.json(result, {
      status: 200,
      headers: withRequestIdHeaders(requestId, {
        "Cache-Control": "no-store",
        "x-rugshield-cache": cacheState,
      }),
    });
  } catch {
    const normalizedAddress = getAddress(address);
    const stale = getStaleCachedResult(normalizedAddress);

    if (stale) {
      return NextResponse.json(
        {
          ...stale,
          warnings: Array.from(
            new Set([
              ...stale.warnings,
              "Returned stale cached result due to temporary upstream failures.",
            ]),
          ),
        },
        {
          status: 200,
          headers: withRequestIdHeaders(requestId, {
            "Cache-Control": "no-store",
            "x-rugshield-cache": "stale",
          }),
        },
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze token due to upstream provider errors." },
      {
        status: 502,
        headers: withRequestIdHeaders(requestId, {
          "Cache-Control": "no-store",
        }),
      },
    );
  }
}
