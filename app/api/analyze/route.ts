import { NextResponse } from "next/server";

import { analyzeToken } from "@/lib/analyzeToken";

interface AnalyzeRequestBody {
  address?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    const address = body.address?.trim();

    if (!address) {
      return NextResponse.json(
        { error: "Token address is required." },
        { status: 400 },
      );
    }

    const result = await analyzeToken(address);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to analyze token." },
      { status: 500 },
    );
  }
}
