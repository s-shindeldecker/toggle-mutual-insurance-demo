# Insurance Quote Demo

Minimal demo app to show a quote decision flow with safe backend experimentation.

## Run

Start the UI server:

```
node src/ui/server.js
```

Optional environment variable:

- `LAUNCHDARKLY_SDK_KEY` to enable LaunchDarkly flag evaluation.

Open: `http://localhost:3000`

## Demo Flow

1) Enter a state, age, and risk proxy (0-100).
2) Run the quote decision.
3) Point out:
   - Eligibility & guardrails (why the quote can/can’t proceed)
   - Experiment strategy selection (baseline vs optimized)
   - Offer result (price + coverage tier)
   - Model outputs (risk/price/propensity)

## Demo Scenarios

- **Baseline behavior**: no LD key set → default baseline strategy.
- **Experiment ON vs OFF**: toggle the `coverage-recommendation-strategy` flag
  between `baseline` and `optimized` to show offer changes.
- **Guardrail blocking instant quote**: set `instant-quote-enabled=false` to
  show ineligibility with no offer.

## Why this is safe experimentation

Guardrails run before experimentation, and experiments only change the offer
strategy. Eligibility and event ordering remain consistent, so you can demo
experimentation without compromising regulated decision logic.

## LaunchDarkly hybrid architecture

Guiding principle: **“The browser may react; the server must decide.”**

Server-side flags (decisions, risk, pricing, eligibility, experiments):
- `coverage-recommendation-strategy`
- `instant-quote-enabled`
- `pricing-engine-enabled`

Client-side flags (presentation only; copy, layout, labels):
- `mascot-text-box`

Rules:
- A flag must never be evaluated on both server and client.
- Decision flags must never be evaluated client-side.
