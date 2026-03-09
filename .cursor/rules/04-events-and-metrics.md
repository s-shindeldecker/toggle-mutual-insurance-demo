---
description: Analytics event and experimentation metric rules
globs:
alwaysApply: true
---

# Events & metrics

1. **No metric_* events.** Never create or emit events prefixed with `metric_`. Use lifecycle events (`quote_*`, `checkout_*`, etc.) exclusively.

2. **Metrics live in LaunchDarkly.** Experimentation metrics are configured in the LD UI as occurrence/count metrics keyed to lifecycle event names. The app must not contain code that decides which events are metrics. All lifecycle events must be emitted server-side using the cookie-backed session context (`tm_session` → `session.key`) and must not rely on client-sent context.

3. **Payloads are additive-only.** Never remove or rename existing fields. Never include PII or `modelOutputs` in any event payload.

4. **Document every event.** Any new or changed event must be documented in `docs/analytics-events.md` with an event contract table (emitter, when, required fields, forbidden fields).

5. **Verify every behavior change.** Any change that affects endpoints, events, or user-visible behavior must update `scripts/smoke.js`. `npm run verify` must pass before the task is complete.
