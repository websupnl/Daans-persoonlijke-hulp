# Product audit (mobile-first) – voorstel

## 1) Inbox module: huidige functie en nut
De inbox is nu een **capture-buffer** voor losse input (`/api/inbox`):
- snelle tekst dumpen
- status `pending` / `processed`
- optionele AI-triage per item

Waarom dit nuttig is:
- voorkomt context-switches (alles eerst dumpen)
- maakt later verwerken mogelijk naar taken/notities/projecten

Waarom het nu nog niet sterk genoeg voelt:
- er is nog geen duidelijke “doorstroom”-flow naar modules
- het is vooral lijstbeheer i.p.v. besluit-flow

## 2) Concrete verbeteringen inbox
1. **1-tap converteren**: inbox-item direct omzetten naar todo/notitie/project-item.
2. **Triage met actieknoppen**: “Maak taak”, “Plan in agenda”, “Koppel aan project”.
3. **SLA/aging**: laat zien welke items >3 dagen pending zijn.
4. **Dagelijkse zero-inbox suggestie**: AI maakt top-3 verwerkadvies.

## 3) Telegram parity (app-chat vs Telegram)
Kloof nu:
- slash-commands zijn aanwezig, maar niet overal zichtbaar genoeg in UX.
- audio werkt; foto-analyse/context-extractie is nog niet volledig productized.
- follow-up werkt vooral sterk bij dagboek-flow, nog niet module-breed.

Aanpak:
1. `/commands` overzicht automatisch tonen na `/start` + periodiek in help.
2. Universele follow-up engine: na mutaties altijd 1 slimme vervolgvraag.
3. Foto pipeline: OCR + intent + “wil je dit opslaan als … ?”.
4. “Truth mode”: AI antwoordt alleen op basis van data + expliciete onzekerheid.

## 4) Mobile-first ontwerpregels (voor alle pagina's)
- max 1 primaire KPI-rij bovenaan
- geen lange uitlegteksten in headers
- detailkaarten achter “toon meer”
- acties sticky onderaan op mobiel
- datumkiezers standaard zichtbaar op agenda/financiën/dagboek

## 5) Nieuwe module: Gezondheid (MVP)
Doel: zachte coaching + signalering zonder medische claims.

MVP onderdelen:
- dagelijkse check-ins: water, slaap, stress-score, energie
- gewoonteschema op dag/tijd (bijv. “vrijdag 12:00 naar bed”) 
- slimme prompts op basis van patroon (stress/slaap/energie)
- veilige taal: “kan wijzen op…”, “overweeg…”, geen diagnose

Datamodel (kort):
- `health_logs(date, water_ml, sleep_hours, stress_score, symptoms, notes)`
- `health_reminders(day_of_week, time, habit, enabled)`
- `health_insights(created_at, insight_type, confidence, message)`

## 6) Gefaseerde uitvoering
- **Fase 1 (nu):** UI ontbloating + mobiele prioriteit + saldo prominent.
- **Fase 2:** Inbox doorstroom + Telegram command UX + follow-up engine.
- **Fase 3:** Health MVP + cross-module AI inzichten.
