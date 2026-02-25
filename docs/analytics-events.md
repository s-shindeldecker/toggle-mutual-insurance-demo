# Analytics Event Taxonomy

This document defines the canonical event taxonomy for the insurance quote
application. It is strict by default and extendable for future functionality.

## Guiding principles
- Events are named in a predictable, domain-first format.
- Payloads are stable; only additive changes are allowed.
- Decision logic is server-side. Client-side events are presentation-only.

## Naming convention (strict)
**Format:** `<domain>_<action>`

- Use lower-case snake_case.
- Domains are fixed:
  - `quote`
  - `checkout`
  - `payment`
  - `policy`
  - `ui`
- Actions should be verbs and consistent across domains
  (e.g., `started`, `evaluated`, `constructed`, `submitted`, `completed`,
  `failed`, `viewed`).

## Common fields (recommended)
These fields should be included where applicable. If a field is not available,
omit it rather than sending nulls.

- `quoteId` (string): required for any quote-related event.
- `status` (string): state of the lifecycle at time of emission.
- `completed` (boolean): used only for `*_completed` events.
- `completionReason` (string): only when `completed === false`.

## Current events (implemented)

### quote_started
Emitted when a quote is initialized.

```
{
  "quoteId": "quote_123",
  "status": "initialized"
}
```

### quote_eligibility_evaluated
Emitted after eligibility is evaluated and guardrails are applied.

```
{
  "quoteId": "quote_123",
  "eligible": true,
  "reasons": []
}
```

Example with guardrail ineligibility:

```
{
  "quoteId": "quote_123",
  "eligible": false,
  "reasons": ["instant_quote_disabled"]
}
```

### quote_offer_constructed
Emitted when an offer is constructed for eligible quotes only.

```
{
  "quoteId": "quote_123",
  "offerStrategy": "baseline",
  "coverageTier": "baseline",
  "price": 132.5
}
```

### quote_completed
Emitted at the end of the quote lifecycle.

Eligible / successfully completed:

```
{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": true
}
```

Ineligible:

```
{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": false,
  "completionReason": "ineligible"
}
```

## Planned events (placeholders)
These are reserved names for upcoming functionality. Do not emit yet.

### checkout_started (Planned)
```
{
  "quoteId": "quote_123",
  "status": "checkout_started"
}
```

### checkout_submitted (Planned)
```
{
  "quoteId": "quote_123",
  "status": "checkout_submitted"
}
```

### checkout_completed (Planned)
```
{
  "quoteId": "quote_123",
  "status": "checkout_completed",
  "completed": true
}
```

### payment_authorized (Planned)
```
{
  "quoteId": "quote_123",
  "status": "payment_authorized"
}
```

### payment_failed (Planned)
```
{
  "quoteId": "quote_123",
  "status": "payment_failed",
  "completed": false,
  "completionReason": "payment_declined"
}
```

### policy_issued (Planned)
```
{
  "quoteId": "quote_123",
  "status": "policy_issued"
}
```

## Extension rules
- Additive-only changes: you may add new optional fields at any time.
- Breaking changes require a new event name, e.g., `quote_completed_v2`.
- Do not reuse an event name for a different meaning or lifecycle step.
