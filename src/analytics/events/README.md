# Analytics Event Definitions

Centralized event names and payload shape references (definitions only).
For the full taxonomy and extension rules, see `docs/analytics-events.md`.

## quote_eligibility_evaluated

Emitted after eligibility is evaluated and guardrails are applied.

{
  "quoteId": "quote_123",
  "eligible": true,
  "reasons": []
}

Example with guardrail ineligibility:

{
  "quoteId": "quote_123",
  "eligible": false,
  "reasons": ["instant_quote_disabled"]
}

## quote_offer_constructed

Emitted when an offer is constructed for eligible quotes only.

{
  "quoteId": "quote_123",
  "offerStrategy": "baseline",
  "coverageTier": "baseline",
  "price": 132.5
}

## quote_completed

Emitted at the end of the quote lifecycle.

Common fields:

{
  "quoteId": "quote_123",
  "status": "completed"
}

For eligible / successfully completed quotes:

{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": true
}

For ineligible quotes:

{
  "quoteId": "quote_123",
  "status": "completed",
  "completed": false,
  "completionReason": "ineligible"
}
