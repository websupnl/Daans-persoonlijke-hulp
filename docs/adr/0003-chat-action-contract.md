# ADR 0003 — Chat action result contract + truthfulness policy

- **Status:** Accepted
- **Datum:** 2026-04-20
- **Beslissingstype:** AI/chat betrouwbaarheid

## Context

Er bestaan parallelle chat-uitvoeringslagen, met risico op mismatch tussen gecommuniceerde uitkomst en feitelijke uitvoering.

## Beslissing

De executielaag levert voor elke actie een contract met minimaal:

- `attempted`: actie is geprobeerd.
- `executed`: actie is technisch uitgevoerd.
- `verified`: read-after-write verificatie is geslaagd.
- `userMessage`: user-facing terugkoppeling.

## Truthfulness policy

De assistant mag alleen een expliciet succesclaim formuleren als:

- `executed === true` én
- `verified === true`.

Als verificatie faalt, moet messaging expliciet onzekerheid/failure communiceren.

## Implementatie

- Canonieke schema’s/types staan in `src/lib/contracts/chat-action-result.ts`.
- Alle muterende chat-acties migreren naar dit contract als “single source of truth”.

