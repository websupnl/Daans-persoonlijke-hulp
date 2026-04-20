# ADR 0001 — Unified design system canon

- **Status:** Accepted
- **Datum:** 2026-04-20
- **Beslissingstype:** Architectuur / frontend

## Context

De codebase bevat meerdere UI-lagen naast elkaar (`button/card/panel/pageshell` én losse design-varianten), wat leidt tot visuele drift en hogere onderhoudslast.

## Beslissing

1. **Canonieke componentlaag:**
   - `src/components/ui/button.tsx`
   - `src/components/ui/card.tsx`
   - `src/components/ui/Panel.tsx`
   - `src/components/ui/PageShell.tsx`
2. **Tokens-only styling als default:** kleuren, radius en schaduw via centrale tokens.
3. **`DesignSystem.tsx` wordt gedepricieerd:**
   - geen nieuwe usage toestaan;
   - bestaande usage migreren naar de canonieke laag.

## Consequenties

- Nieuwe UI-ontwikkeling wordt consistenter en voorspelbaarder.
- Legacy UI vereist gefaseerde migratie.

## Implementatieregel

Nieuwe schermen of substantiële refactors mogen niet mergen zonder canonieke primitives.

