# RugShield

RugShield is a Next.js 14 + TypeScript token risk analyzer for Ethereum ERC-20 contracts.

## What it analyzes

- Contract risk via Etherscan V2 metadata + on-chain contract probing
- Liquidity risk via Dexscreener pool depth and liquidity quality signals
- Holder concentration via Covalent (primary) with Ethplorer fallback
- Honeypot behavior via Honeypot.is simulation with heuristic fallback
- Weighted risk score (0-100) with confidence score
- Client-side scan history snapshots for quick comparison between recent analyses
- Input normalization, local recent-scan recall, and example token shortcuts in the scanner

## API

### `GET /api/analyze`

Operational status payload for health checks and lightweight diagnostics:

```json
{
  "status": "ok",
  "service": "rugshield-analyze",
  "timestamp": "2026-03-16T12:34:56.000Z",
  "cache": {
    "entries": 4,
    "inFlight": 0,
    "staleEligible": 1,
    "ttlMs": 45000,
    "staleMs": 300000
  },
  "rateLimit": {
    "windowMs": 60000,
    "maxRequestsPerWindow": 45
  }
}
```

Response headers now include:

- `x-rugshield-request-id`
- `x-rugshield-cache` on analysis responses
- `x-rugshield-duration-ms`
- `x-rugshield-rate-limit`
- `x-rugshield-rate-limit-remaining`
- `x-rugshield-rate-limit-reset`

### `POST /api/analyze`

Request body:

```json
{ "address": "0x..." }
```

Success response shape:

```json
{
  "score": 41,
  "confidence": 0.86,
  "contract": "ExampleToken",
  "liquidity": 128394,
  "warnings": ["Liquidity is below $500,000."],
  "topHolderPercent": 24.1,
  "top10HolderPercent": 70.44,
  "breakdown": {
    "contract": 28,
    "liquidity": 18,
    "holders": 14,
    "honeypot": 22
  },
  "sources": {
    "holdersProvider": "covalent",
    "honeypotMethod": "api"
  },
  "meta": {
    "requestId": "7f6c3c7a-3aa9-4bc3-b964-5dc3239ed138",
    "analyzedAddress": "0x0000000000000000000000000000000000000000",
    "generatedAt": "2026-03-16T12:34:56.000Z",
    "durationMs": 912,
    "cache": "miss",
    "stale": false
  }
}
```

## Environment variables

Set these in `.env.local`:

```bash
ETHERSCAN_API_KEY=
ETHERSCAN_CHAIN_ID=1
COVALENT_API_KEY=
COVALENT_CHAIN_NAME=eth-mainnet
ETHPLORER_API_KEY=
ETH_RPC_URL=
```

Notes:
- `ETH_RPC_URL` is optional but recommended for production stability.
- `COVALENT_CHAIN_NAME` defaults to `eth-mainnet`.
- If `COVALENT_API_KEY` is missing/unavailable, holder concentration falls back to Ethplorer.
- If `ETHERSCAN_API_KEY` is missing, source-verification checks run in reduced-confidence mode.

## Run

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run typecheck
```

## Production behavior

- Request validation for malformed/invalid addresses
- In-memory rate limiting on `/api/analyze`
- Upstream request retries + timeouts
- Fault-isolated analyzers with safe fallbacks (single-provider failures no longer fail entire scan)
- Short-lived in-memory analysis cache with in-flight de-duplication for repeated addresses
- Stale-result fallback when upstream providers are temporarily unavailable
- API operational status endpoint: `GET /api/analyze`
- Per-request trace header: `x-rugshield-request-id`
- Analysis response metadata payload via `meta` (cache mode + timing)
- Rate-limit and duration response headers for API diagnostics
- No-store API response caching headers
- Scanner UX includes example shortcuts, checksum normalization, clearable recent scans, and local scan history snapshots
