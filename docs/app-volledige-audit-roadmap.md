# Volledige app-audit + verbeterplan (architectuur, logica, pagina's, design)

## 1) Executive summary

De app heeft **sterke functionele breedte** (26 pagina-routes, 80 API-routes, veel domeinen), maar lijdt nu onder:

1. **Architectuur-fragmentatie** (oude + nieuwe patronen naast elkaar).
2. **UI-systeem-fragmentatie** (meerdere design- en componentlagen tegelijk).
3. **Onvoldoende consistente applicatie-shell en pagina-opbouw**.
4. **Logica-risico in chat/AI-acties** (actie-uitkomst vs respons consistency).
5. **Grote onderhoudslast** door ontbreken van één duidelijke “golden path”.

Kort: de app is niet “slecht”, maar hij voelt niet af omdat de basisprincipes niet overal gelijk zijn doorgevoerd.

---

## 2) Huidige structuur (wat staat er nu)

### Frontend / routes

- 26 page routes in `src/app/**/page.tsx`.
- Grootste functionele domeinen: dashboard, chat, taken, financiën, notities, agenda, gewoontes, projecten, import, etc.
- De meeste pagina’s gebruiken `AppShell`, maar er zijn uitzonderingen (`/admin/tenants`, `/dev`, `/projects/[id]`, `/login`).

### API / backend

- 80 API-routes met veel domeinen (`finance`, `import`, `ai`, `worklogs`, `todos`, `telegram`, etc.).
- Middleware met auth + allowlists werkt, maar de omvang van uitzonderingspaden is een signaal dat auth-policy centralisatie beter kan.

### Data / database

- Centrale `db.ts` met schema-init en query helpers.
- Rijke tabellen-set: projecten, todos, finance, habits, journal, notes, chat, memory, worklogs, inbox, etc.

### AI / chat

- Chat endpoint op `/api/chat` met parsing + action execution + response generatie.
- Daarnaast bestaat nog `SimpleChatProcessor` met een tweede, beperktere chat-uitvoeringslaag.
- Dit impliceert risico op inconsistent gedrag, duplicatie en moeilijk debuggen.

### UI / design

- `globals.css` bevat goed begin van tokens (`--accent`, `--surface`, radii, shadows).
- Tegelijk bestaan meerdere UI-lagen:
  - `ui/card.tsx`, `ui/button.tsx`, `ui/Panel.tsx`, `PageShell`.
  - Losse `DesignSystem.tsx` met alternatieve componenten die niet gebruikt worden.
- Dat veroorzaakt visuele en gedragsmatige drift.

---

## 3) Belangrijkste problemen (inhoudelijk)

## A. Structuurproblemen

1. **Geen duidelijke feature-slicing**
   - Veel domeinen zitten wel logisch, maar patterns verschillen per feature (soms nette view-component, soms alles in page of client component).
2. **Parallelle architecturen**
   - Vooral zichtbaar in chat/AI (meerdere engines/stromen).
3. **Dev/admin routes buiten shell-standaard**
   - Kan bewust zijn, maar voelt als productmatig “ander systeem”.

## B. Logica- en kwaliteitrisico

1. **Command→actie→resultaat keten is niet uniform afgedwongen**
   - Kans op mismatch tussen “wat AI zegt” en “wat echt gelukt is”.
2. **Geen eenduidige action contracten over alle paden**
   - Verschillende plaatsen met eigen resultaat-structuur/afhandeling.
3. **Verificatie niet overal gelijk**
   - Sommige paden hebben read-after-write checks, andere minder hard.

## C. Design / UX-issues

1. **Inconsistent componentgebruik**
   - Zelfde type UI-elementen verschillen per pagina (cards, spacing, headers).
2. **Te veel varianten / onvoldoende compositie-richtlijnen**
   - Moeilijk om nieuwe pagina’s consistent te bouwen.
3. **Mobiele consistentie niet systematisch getoetst**
   - Er is mobile nav, maar pagina-implementaties variëren te veel.

## D. Operatie / onderhoud

1. **Hoge cognitieve load voor contributors**
   - Welke laag is “de juiste”?
2. **Documentatie deels aanwezig maar niet gecementeerd in werkafspraken**
   - Er zijn analyses, maar geen afdwingbaar implementatiepad.

---

## 4) Volledige verbeterstrategie (good practices als standaard)

## Fase 0 — Stabiliseer & meetbaar maken (1 week)

Doel: eerst veiligheid en zichtbaarheid.

1. **Architectuur-baseline vastleggen**
   - Maak 1 bronbestand: “Current State Map” met alle routes, owners, status (legacy/new).
2. **Definition of Done voor elke feature**
   - Vereist: loading/empty/error states, mobiele check, API error contract, telemetry event.
3. **Kernmetriek-dashboard**
   - Chat action success rate, API error rate per domein, UI regressions per release.

## Fase 1 — Unified Design System (2 weken)

Doel: alles visueel gelijk trekken.

1. **Design tokens canoniseren**
   - Alleen token-based kleuren/radii/shadows (geen ad-hoc classes buiten uitzonderingen).
2. **Één componentlaag kiezen**
   - Houd `Button`, `Card`, `Panel`, `PageShell` als basis.
   - Markeer `DesignSystem.tsx` als deprecated en migreer of verwijder.
3. **Layout-standaard per pagina**
   - Header patroon, section spacing, cards, actions, empty states, list rows.
4. **Mobile-first QA matrix**
   - 360px / 390px / 768px standaard per kernpagina.

## Fase 2 — Feature architecture refactor (2–3 weken)

Doel: schaalbare code-structuur.

1. **Feature folders invoeren (vertical slices)**
   - bv. `src/features/finance`, `src/features/chat`, `src/features/todos`.
2. **Duidelijke grenzen**
   - `app/` = routing only, `features/` = use-cases + UI, `lib/` = infra/shared.
3. **API standardization**
   - Uniforme response envelope (`success`, `data`, `error`, `meta`).
4. **Shared typed contracts**
   - Zod schemas voor request/response tussen frontend en backend.

## Fase 3 — Chat/AI truthfulness hardening (2 weken)

Doel: nooit meer fake-success gedrag.

1. **Single action execution pipeline**
   - Eén engine als bron van waarheid (de andere laag uitfaseren).
2. **Action result contract**
   - `attempted`, `executed`, `verified`, `user_message`.
3. **Read-after-write verificatie verplicht**
   - Voor alle mutaties met heldere fallback als verify faalt.
4. **Response policy**
   - AI mag alleen “gelukt” zeggen als `verified === true`.

## Fase 4 — Pagina-kwaliteit en UX polish (2 weken)

Doel: elk scherm productiekwaliteit.

Per pagina minimaal:
- Skeleton loading.
- Lege staat met CTA.
- Heldere foutstaat.
- Consistente top-actions.
- Keyboard/accessibility pass.

Prioriteitspagina’s:
1. Dashboard
2. Chat
3. Finance
4. Todos
5. Projects + detail
6. Notes

## Fase 5 — Teststrategie en release discipline (doorlopend)

1. **Testpiramide herstellen**
   - Unit: parsers/engines.
   - Integration: API handlers + DB mocks.
   - E2E: kernflows (todo, finance import, chat actions).
2. **Visual regression snapshots**
   - Voor top 10 pagina’s.
3. **Release train**
   - Wekelijkse cut met changelog + rollback-plan.

---

## 5) Pagina-audit aanpak (alle pagina’s)

Voor alle 26 pagina’s hanteer dit sjabloon:

1. **Route & doel** (waarom bestaat de pagina?).
2. **Data dependencies** (welke API’s, welke states?).
3. **UX states** (loading/empty/error/success).
4. **Design compliance** (tokens/components/layout-grid).
5. **Performance** (server/client boundaries, fetch patterns).
6. **A11y** (labels, contrast, focus order, toetsenbord).
7. **Testdekking** (unit/integration/e2e aanwezig?).
8. **Verbeteracties + effort** (S/M/L + impact score).

Resultaat: één backlog met score per pagina:
- **P0** = functioneel risico / datarisico.
- **P1** = UX/design inconsistentie.
- **P2** = codekwaliteit/maintainability.

---

## 6) Concrete backlog (eerste 30 dagen)

## Week 1
- [ ] Design system ADR: “één componentlaag, tokens-only”.
- [ ] API contract ADR: uniforme error/success envelopes.
- [ ] Chat action contract vastleggen + instrumentation hooks.
- [ ] Start page inventory met scorekaart.

## Week 2
- [ ] Migrate 5 kernpagina’s naar identieke PageShell/Panel patronen.
- [ ] Introduceer shared empty/error/skeleton component set.
- [ ] Verwijder of migreer ongebruikte design-componenten.

## Week 3
- [ ] Chat pipeline unificeren (single executor).
- [ ] Verificatie voor alle mutaties verplicht maken.
- [ ] Integratietests voor top 10 chat commands.

## Week 4
- [ ] Mobile UX fine-tuning voor kernflows.
- [ ] E2E smoke-suite in CI.
- [ ] Release checklist + observability dashboard live.

---

## 7) Good-practice standaarden (definitief invoeren)

1. **Single source of truth per domein**
   - Geen parallelle engines zonder expliciete migratievlag.
2. **Typed interfaces end-to-end**
   - Request/response en domain models gedeeld.
3. **UI compositie boven custom styling per pagina**
   - Minder one-off classes, meer herbruikbare primitives.
4. **Error-first engineering**
   - Elk pad heeft expliciete foutafhandeling met user-safe messaging.
5. **Observability by default**
   - Elke mutatie emit event + correlation id.
6. **Progressive enhancement op mobiel**
   - Eerst mobiel correct, dan desktop verrijking.

---

## 8) Risico’s als dit niet gebeurt

- Meer regressies door inconsistenties.
- Chat-vertrouwen daalt bij foutieve bevestigingen.
- Nieuwe features worden trager en duurder.
- UX blijft “niet top” ondanks losse fixes.

---

## 9) Verwacht resultaat na uitvoering

Na 6–8 weken:

- Eén uniforme look & feel over alle kernpagina’s.
- Betrouwbare chat-acties met controleerbare outcomes.
- Sneller ontwikkeltempo door duidelijke architectuur-paden.
- Minder bugs/rework en betere gebruikersbeleving op mobiel én desktop.

---

## 10) Implementatiestatus (toegepast op 2026-04-20)

Onderstaande fundamenten uit fase 0/1/3 zijn nu concreet vastgelegd in de repository:

- ✅ Current State Map toegevoegd: `docs/current-state-map.md`
- ✅ Definition of Done toegevoegd: `docs/definition-of-done.md`
- ✅ Design System ADR toegevoegd: `docs/adr/0001-design-system-canon.md`
- ✅ API Envelope ADR + contractlaag toegevoegd:
  - `docs/adr/0002-api-response-envelope.md`
  - `src/lib/contracts/api-envelope.ts`
- ✅ Chat Action Contract ADR + contractlaag toegevoegd:
  - `docs/adr/0003-chat-action-contract.md`
  - `src/lib/contracts/chat-action-result.ts`

### Geactualiseerde 30-dagen backlogstatus

## Week 1
- [x] Design system ADR: “één componentlaag, tokens-only”.
- [x] API contract ADR: uniforme error/success envelopes.
- [x] Chat action contract vastleggen + instrumentation hooks (contractniveau).
- [x] Start page inventory met scorekaart.

## Week 2+
- [ ] Migrate 5 kernpagina’s naar identieke PageShell/Panel patronen.
- [ ] Introduceer shared empty/error/skeleton component set.
- [~] Verwijder of migreer ongebruikte design-componenten (deprecation marker actief).
- [~] Chat pipeline unificeren (single executor) in runtime implementatie (contract-layer live op `/api/chat` output).
- [~] Verificatie voor alle mutaties verplicht maken (error-contract + typed action-result contract op kernroutes).
- [ ] Integratietests voor top 10 chat commands.
- [ ] Mobile UX fine-tuning voor kernflows.
- [ ] E2E smoke-suite in CI.
- [ ] Release checklist + observability dashboard live.

### Uitvoering codebase (increment 2026-04-20)

- API response envelope nu toegepast op kernroutes:
  - `/api/chat` (GET/DELETE + typed action-result output).
  - `/api/todos` en `/api/todos/[id]`.
  - `/api/notes` en `/api/notes/[id]`.
  - `/api/finance` en `/api/finance/[id]`.
  - `/api/contacts` en `/api/contacts/[id]`.
  - `/api/projects` en `/api/projects/[id]`.
  - `/api/events` en `/api/events/[id]`.
  - `/api/groceries` en `/api/groceries/[id]`.
- Nieuwe helper `src/lib/contracts/api-http.ts` verzorgt consistente success/error responses met `correlationId` en timestamp metadata.
