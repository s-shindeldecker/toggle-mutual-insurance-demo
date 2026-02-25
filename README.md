# Insurance Quote Demo

Minimal demo app to show a quote decision flow with safe backend experimentation.

## Run

Start the UI server:

```
node src/ui/server.js
```

Optional environment variable:

- `LAUNCHDARKLY_SDK_KEY` to enable LaunchDarkly flag evaluation.
- `LAUNCHDARKLY_CLIENT_ID` to enable client-side UI flag evaluation.

Open: `http://localhost:3000`

## Demo Flow

1) Enter state, age, vehicle type, and annual mileage band.
2) Get a quote, then proceed through summary, checkout, confirmation.
3) Point out:
   - Eligibility & guardrails (why the quote can/can’t proceed)
   - Experiment strategy selection (baseline vs optimized)
   - Offer result (price + coverage tier)
   - Decision summary (risk tier, strategy rationale)

## Demo Scenarios

- **Baseline behavior**: no LD key set → default baseline strategy.
- **Experiment ON vs OFF**: toggle the `coverage-recommendation-strategy` flag
  between `baseline` and `optimized` to show offer changes.
- **Guardrail blocking instant quote**: set `instant-quote-enabled=false` to
  show ineligibility with no offer.
- **Presentation copy**: change `mascot-text-box` to update the homepage label.

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

## LaunchDarkly multi-context strategy

We use LaunchDarkly multi-contexts (`kind: "multi"`) to group user, vehicle,
and location data under a single evaluation.

- **Client-side**: starts with an anonymous `user` context and progressively
  calls `identify` as the user completes the address, personal, and vehicle
  steps. This is used only for presentation flags.
- **Server-side**: builds its own multi-context from the authoritative quote
  inputs and uses it for decision flags (eligibility, guardrails, strategy).

Client and server contexts are **not shared**; they are built independently
from the same collected data to keep decision logic server-side.
