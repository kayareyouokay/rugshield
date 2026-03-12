# RugShield

RugShield is a Next.js 14 + TypeScript token risk analyzer for Ethereum ERC-20 contracts.

## What it analyzes

- Contract risk via Etherscan V2 metadata + on-chain contract probing
- Liquidity risk via Dexscreener pool depth and liquidity quality signals
- Holder concentration via Covalent (primary) with Ethplorer fallback
- Honeypot behavior via Honeypot.is simulation with heuristic fallback
- Weighted risk score (0-100) with confidence score

## API

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

## Production behavior

- Request validation for malformed/invalid addresses
- In-memory rate limiting on `/api/analyze`
- Upstream request retries + timeouts
- No-store API response caching headers
