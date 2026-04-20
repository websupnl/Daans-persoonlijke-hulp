# Definition of Done (feature-level)

_Geldig vanaf: 2026-04-20._

Elke feature of paginawijziging is pas “Done” als alle onderstaande punten expliciet zijn afgevinkt.

## 1) UX en states

- [ ] Loading state aanwezig (skeleton of equivalent).
- [ ] Empty state aanwezig met duidelijke CTA.
- [ ] Error state aanwezig met user-safe tekst + herstelactie.
- [ ] Success state begrijpelijk en consistent met daadwerkelijke uitkomst.

## 2) Mobile en layout

- [ ] Gevalideerd op **360px**, **390px** en **768px**.
- [ ] Geen horizontale overflow zonder intentie.
- [ ] Top-actions bruikbaar op touch.
- [ ] Visuele opbouw volgt `PageShell`/`Panel`-patroon (of gedocumenteerde uitzondering).

## 3) API contract en fouten

- [ ] API gebruikt standaard envelope: `success`, `data`, `error`, `meta`.
- [ ] Error-cases retourneren machine-leesbare `code` + veilige boodschap.
- [ ] Validatie (input/output) vastgelegd met schema’s.

## 4) Telemetry en observability

- [ ] Minimaal één domein-event op kritische mutatie.
- [ ] Correlation id aanwezig voor muterende flows.
- [ ] Fouten loggen zonder gevoelige data te lekken.

## 5) Kwaliteit en testen

- [ ] Unit-tests voor kritische parser/transform-logica.
- [ ] Integratietest voor API-handler van de wijziging.
- [ ] Bestaande tests blijven groen.

## 6) Toegankelijkheid (A11y)

- [ ] Form controls hebben labels.
- [ ] Keyboard-navigatie en focus-volgorde gecontroleerd.
- [ ] Contrast en visuele focus-indicator toereikend.

## 7) Documentatie

- [ ] Relevante docs/ADR bijgewerkt bij architectuur- of contractwijziging.
- [ ] Wijziging opgenomen in de release notes/changelog.

