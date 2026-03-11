# RugShield

RugShield is a Next.js 14 + TypeScript Web3 dashboard that scans ERC-20 token addresses and estimates rug-pull risk.

## Features

- Contract analysis via Etherscan (verification, proxy, mint, owner controls)
- Liquidity checks via Dexscreener
- Holder concentration checks via Ethplorer
- Honeypot heuristic placeholder module for future simulation
- Aggregated risk score from 0 to 100

## API

`POST /api/analyze`

Request body:

```json
{ "address": "0x..." }
```

Response:

```json
{
  "score": 62,
  "contract": "ExampleToken",
  "liquidity": 128394,
  "warnings": ["Liquidity is below $50,000."]
}
```

## Environment Variables

Use `.env.local`:

```bash
ETHERSCAN_API_KEY=
COVALENT_API_KEY=
```

## Run

```bash
npm install
npm run dev
```
