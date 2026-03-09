# AGENTS.md — Working Agreement

This document is the source of truth for any contributor (human or AI agent)
working in this repository. Read it before making changes.

## Project

Toggle Mutual Insurance — a demo app that runs a quote decision flow with
safe backend experimentation via LaunchDarkly feature flags.

## Stack constraints

- **Runtime:** Node.js (CommonJS — `"type": "commonjs"` in package.json)
- **Frontend:** React 18 via ESM CDN (`esm.sh`) + `htm` tagged templates. No JSX.
- **Server:** Plain `http.createServer`. Express is a dependency but is **not used**.
- **Styling:** Inline `<style>` in `src/ui/index.html`. No CSS framework.
- **Build tooling:** None. No bundler, no transpiler, no TypeScript.
- **Tests:** No test framework. Verification uses `scripts/smoke.js` (plain Node).

Do **not** introduce TypeScript, a bundler, or a test framework unless explicitly
asked. Keep all source files as CommonJS `.js`.

## Architecture rules

1. **"The browser may react; the server must decide."**
   Decision flags (eligibility, pricing, risk, strategy) are evaluated
   server-side only. Client-side flags are presentation-only (copy, layout).

2. A flag must never be evaluated on both server and client.

3. The quote decision pipeline lives in `src/quote/decisionFlow.js`.
   Steps run sequentially: init → models → eligibility → guardrails →
   strategy → offer → complete. Do not reorder or skip steps.

4. Analytics events follow the taxonomy in `docs/analytics-events.md`.
   Event names are `<domain>_<action>`, lower-case snake_case. Payloads
   are additive-only; breaking changes require a new event name.

5. Model outputs (`modelOutputs`) are **never** sent to the client.
   The server strips them before responding.

## LaunchDarkly conventions

### Server-side flags (src/experiments/launchdarklyClient.js)

| Flag key                           | Type    | Default      |
|------------------------------------|---------|-------------|
| `coverage-recommendation-strategy` | string  | `"baseline"` |
| `instant-quote-enabled`            | boolean | `true`       |
| `pricing-engine-enabled`           | boolean | `true`       |
| `risk-model-variant`               | string  | `"baseline"` |
| `pricing-model-variant`            | string  | `"baseline"` |

### Client-side flags (src/ui/app.js)

| Flag key         | Type   | Default                         |
|------------------|--------|---------------------------------|
| `mascot-text-box`| string | `"Meet ToMu — the Tree Shrew"` |

### Multi-context

Both server and client build `kind: "multi"` contexts with sub-contexts:
`session`, `user`, `vehicle`, `location`. Client and server contexts are
built independently from the same form data.

### MCP tooling

The LaunchDarkly MCP server (`user-LaunchDarkly`) is available in Cursor
for flag management (list, get, create, update, delete flags and AI configs).

## Environment variables

See `.env.example` for the full list. Required variables for LaunchDarkly
integration:

| Variable                 | Purpose                          |
|--------------------------|----------------------------------|
| `PORT`                   | Server listen port (default 3000)|
| `LAUNCHDARKLY_SDK_KEY`   | Server-side flag evaluation      |
| `LAUNCHDARKLY_CLIENT_ID` | Client-side flag evaluation      |

The app runs without LD keys — all flags fall back to defaults.

## Scripts

| Command           | What it does                                    |
|-------------------|-------------------------------------------------|
| `npm run dev`     | Start the dev server (`node src/ui/server.js`)  |
| `npm run verify`  | Require-check all modules + run smoke tests     |

Always run `npm run verify` before committing.

## File layout

```
src/
├── ui/              # HTTP server, HTML shell, React SPA
├── quote/           # Quote class, decision flow, offer construction
├── models/fake/     # Deterministic fake risk/pricing/propensity models
├── experiments/     # LaunchDarkly server-side client and flag helpers
├── analytics/       # Event emitter, tracker, event name constants
└── example/         # CLI runner for the quote flow
scripts/
├── dev              # Dev server launcher
├── verify           # Full verification (module check + smoke test)
└── smoke.js         # HTTP smoke test against a live server
docs/
└── analytics-events.md
```

## Code style

- No test frameworks. Verification lives in `scripts/`.
- Comments explain non-obvious intent, not what the code does.
- Analytics failures must not interrupt the quote lifecycle.
- All new server-side flags need a fallback default value.
- Keep fake models deterministic (no `Math.random`).
