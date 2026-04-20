# ADR 0002 — Uniform API response envelope

- **Status:** Accepted
- **Datum:** 2026-04-20
- **Beslissingstype:** API contract

## Context

API-routes gebruiken niet overal exact dezelfde response-shape, waardoor frontend-afhandeling en monitoring complexer wordt.

## Beslissing

Elke API response gebruikt dit envelope:

```ts
{
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    correlationId?: string
    timestamp?: string
  }
}
```

## Consequenties

- Eenduidige frontend error/success handling.
- Betere observability en tracebaarheid.
- Kleine migratiekost voor bestaande handlers.

## Implementatie

- Canonieke types/schemas staan in `src/lib/contracts/api-envelope.ts`.
- Nieuwe handlers moeten direct deze contractlaag gebruiken.

