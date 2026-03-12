import { isAddress } from "ethers";
import { NextResponse } from "next/server";

import { analyzeToken } from "@/lib/analyzeToken";

interface AnalyzeRequestBody {
  address?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 45;

const globalState = globalThis as typeof globalThis & {
  __rugshieldRateLimitStore?: Map<string, RateLimitEntry>;
};

const rateLimitStore =
  globalState.__rugshieldRateLimitStore ??
  (globalState.__rugshieldRateLimitStore = new Map<string, RateLimitEntry>());

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(clientId: string) {
  const now = Date.now();

  if (rateLimitStore.size > 5_000) {
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

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);

  if (isRateLimited(clientId)) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a minute and try again.",
      },
      { status: 429 },
    );
  }

  let body: AnalyzeRequestBody;

  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const address = body.address?.trim();

  if (!address) {
    return NextResponse.json(
      { error: "Token address is required." },
      { status: 400 },
    );
  }

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Provided token address is not a valid EVM address." },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeToken(address);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to analyze token due to upstream provider errors." },
      { status: 502 },
    );
  }
}
