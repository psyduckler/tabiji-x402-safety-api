# Tabiji x402 Scam & Safety API

Cloudflare Worker for x402-paid, deterministic Tabiji scam/safety briefs.

## Production endpoints

Free:

- `GET /health`
- `GET /v1/meta`

Paid with x402/Base USDC:

- `POST /v1/scam-brief` — `$0.05`
- `POST /v1/safety-brief` — `$0.05`
- `POST /v1/travel-risk-brief` — `$0.10`

Payment receiver:

```txt
0x59959450bb3DA79A8bC07CC078696D6CBA3bEB4a
```

Network:

```txt
eip155:8453 // Base mainnet
```

## Request example

```bash
curl -X POST https://x402.tabiji.ai/v1/scam-brief \
  -H 'content-type: application/json' \
  -d '{
    "destination": "Barcelona",
    "travelerProfile": "US first-time visitor age 45+",
    "format": "agent_brief"
  }'
```

Without x402 payment this should return HTTP `402 Payment Required`.

## Deploy

Requires Cloudflare auth for the `tabiji.ai` zone.

```bash
npm install
npm run typecheck
npm run deploy
```

If deploying from a clean machine:

```bash
wrangler login
# or configure CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID securely
npm run deploy
```

## Notes

- v0 is deterministic/extractive only: no LLM key required.
- The free Tabiji API remains the source/distribution layer: `https://tabiji.ai/api/`.
- The paid Worker synthesizes agent-ready briefs from Tabiji public JSON/catalog records.
