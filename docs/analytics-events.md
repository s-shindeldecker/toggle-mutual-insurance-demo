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

## Quote lifecycle stages

The `status` field represents where the quote is in its lifecycle. Every
event payload that includes `status` **must** use one of these values:

| Stage          | Meaning                                      |
|----------------|----------------------------------------------|
| `initialized`  | Quote created, no evaluation yet              |
| `eligibility`  | Eligibility evaluated and guardrails applied  |
| `offer`        | Offer constructed (eligible quotes only)      |
| `completed`    | Lifecycle ended (quote or checkout)           |
| `checkout`     | Checkout in progress                          |
| `payment`      | Payment processing (planned)                  |
| `policy`       | Policy issued (planned)                       |

Stages are append-only. Do not redefine an existing stage.

## Common fields (recommended)
These fields should be included where applicable. If a field is not available,
omit it rather than sending nulls.

- `quoteId` (string): required for any quote-related event.
- `status` (string): lifecycle stage at time of emission — must be a value
  from the table above.
- `completed` (boolean): used only for `*_completed` events.
- `completionReason` (string): only when `completed === false`.

## Current events (implemented)

### quote_started

Emitted when a quote is initialized.

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`decisionFlow.js`)                       |
| When            | Start of `runQuoteDecisionFlow`                  |
| Required fields | `quoteId`, `status`                              |
| Forbidden       | PII, `modelOutputs`                              |

```
{
  "quoteId": "quote_123",
  "status": "initialized"
}
```

### quote_eligibility_evaluated

Emitted after eligibility is evaluated and guardrails are applied.

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`decisionFlow.js`)                       |
| When            | After eligibility + guardrails finalized         |
| Required fields | `quoteId`, `status`, `eligible`, `reasons`       |
| Forbidden       | PII, `modelOutputs`                              |

```
{
  "quoteId": "quote_123",
  "status": "eligibility",
  "eligible": true,
  "reasons": []
}
```

Example with guardrail ineligibility:

```
{
  "quoteId": "quote_123",
  "status": "eligibility",
  "eligible": false,
  "reasons": ["instant_quote_disabled"]
}
```

### quote_offer_constructed

Emitted when an offer is constructed for eligible quotes only.

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`decisionFlow.js`)                       |
| When            | After offer is built (eligible quotes only)      |
| Required fields | `quoteId`, `status`, `offerStrategy`, `riskModelVariant`, `pricingModelVariant`, `coverageTier`, `price` |
| Forbidden       | PII, `modelOutputs`                              |

```
{
  "quoteId": "quote_123",
  "status": "offer",
  "offerStrategy": "baseline",
  "riskModelVariant": "baseline",
  "pricingModelVariant": "baseline",
  "coverageTier": "baseline",
  "price": 132.5
}
```

### quote_completed

Emitted at the end of the quote lifecycle. Suitable as a LaunchDarkly
occurrence metric source (define the metric in LD, not in app code).

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`decisionFlow.js`)                       |
| When            | End of decision flow, always emitted             |
| Required fields | `quoteId`, `status`, `completed`, `offerStrategy`, `riskModelVariant`, `pricingModelVariant` |
| Forbidden       | PII, `modelOutputs`                              |
| Context         | Server-built multi-context (session cookie)      |

Eligible / successfully completed:

```
{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": true,
  "offerStrategy": "baseline",
  "riskModelVariant": "baseline",
  "pricingModelVariant": "baseline"
}
```

Ineligible:

```
{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": false,
  "completionReason": "ineligible",
  "offerStrategy": "baseline",
  "riskModelVariant": "baseline",
  "pricingModelVariant": "baseline"
}
```

### checkout_started

Emitted when a checkout begins on the server.

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`server.js`)                             |
| When            | Start of `POST /api/checkout` handler            |
| Required fields | `quoteId`, `status`                              |
| Forbidden       | PII, `modelOutputs`                              |
| Context         | Server-built multi-context (session cookie)      |

```
{
  "quoteId": "quote_123",
  "status": "checkout"
}
```

### checkout_submitted

Emitted after checkout data is accepted.

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`server.js`)                             |
| When            | After checkout input validated                   |
| Required fields | `quoteId`, `status`                              |
| Forbidden       | PII, `modelOutputs`                              |
| Context         | Server-built multi-context (session cookie)      |

```
{
  "quoteId": "quote_123",
  "status": "checkout"
}
```

### checkout_completed

Emitted when checkout finishes successfully. Suitable as a LaunchDarkly
occurrence metric source (define the metric in LD, not in app code).

| Contract        | Value                                            |
|-----------------|--------------------------------------------------|
| Emitter         | Server (`server.js`)                             |
| When            | After confirmation ID generated                  |
| Required fields | `quoteId`, `status`, `completed`, `confirmationId` |
| Forbidden       | PII, `modelOutputs`                              |
| Context         | Server-built multi-context (session cookie)      |

```
{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": true,
  "confirmationId": "CONF-1"
}
```

## Planned events (placeholders)
These are reserved names for upcoming functionality. Do not emit yet.

### payment_authorized (Planned)
```
{
  "quoteId": "quote_123",
  "status": "payment"
}
```

### payment_failed (Planned)
```
{
  "quoteId": "quote_123",
  "status": "payment",
  "completed": false,
  "completionReason": "payment_declined"
}
```

### policy_issued (Planned)
```
{
  "quoteId": "quote_123",
  "status": "policy"
}
```

## Extension rules
- Additive-only changes: you may add new optional fields at any time.
- Breaking changes require a new event name, e.g., `quote_completed_v2`.
- Do not reuse an event name for a different meaning or lifecycle step.
- New lifecycle stages must be appended to the table above.
