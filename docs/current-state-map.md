# Current State Map (baseline)

_Gelast-update: 2026-04-20 (UTC)._  
_Dit document is de centrale bron voor route-overzicht en moderniseringsstatus._

## Scope en doel

Dit bestand operationaliseert fase 0 uit `docs/app-volledige-audit-roadmap.md`:

- Eén bronbestand met actuele route-inventory.
- Aanduiding legacy/new status op shell- en componentniveau.
- Input voor prioritering (P0/P1/P2) in de backlog.

## Kerncijfers

- **Page routes:** 26
- **API routes:** 80
- **Page routes met `AppShell`:** 22 / 26
- **Page routes zonder `AppShell`:** 4 / 26

## Pagina-routes

| Route | Shell status | Audit-status | Prioriteit | Notitie |
|---|---|---:|---:|---|
| `/` | New (`AppShell`) | Te auditen | P1 | Dashboard-kernflow |
| `/agenda` | New (`AppShell`) | Te auditen | P2 | |
| `/chat` | New (`AppShell`) | Te auditen | **P0** | Truthfulness + action consistency |
| `/contacts` | New (`AppShell`) | Te auditen | P2 | |
| `/dev` | Legacy (zonder shell) | Te auditen | P2 | Bewust dev-surface |
| `/finance` | New (`AppShell`) | Te auditen | **P0** | Financiële datakwaliteit |
| `/groceries` | New (`AppShell`) | Te auditen | P2 | |
| `/habits` | New (`AppShell`) | Te auditen | P1 | Fake-success risico in analyses |
| `/ideas` | New (`AppShell`) | Te auditen | P2 | |
| `/import` | New (`AppShell`) | Te auditen | P1 | |
| `/import/[runId]/review` | New (`AppShell`) | Te auditen | **P0** | Data-import correctness |
| `/inbox` | New (`AppShell`) | Te auditen | P1 | |
| `/journal` | New (`AppShell`) | Te auditen | P2 | |
| `/login` | Legacy (zonder shell) | Te auditen | P2 | Auth-flow intentionally isolated |
| `/memory` | New (`AppShell`) | Te auditen | P2 | |
| `/notes` | New (`AppShell`) | Te auditen | P1 | |
| `/notes/[id]` | New (`AppShell`) | Te auditen | P1 | |
| `/patterns` | New (`AppShell`) | Te auditen | P2 | |
| `/projects` | New (`AppShell`) | Te auditen | P1 | |
| `/projects/[id]` | Legacy (zonder shell) | Te auditen | P1 | Detail-layout harmoniseren |
| `/search` | New (`AppShell`) | Te auditen | P2 | |
| `/timeline` | New (`AppShell`) | Te auditen | P2 | |
| `/todos` | New (`AppShell`) | Te auditen | **P0** | Kernflow |
| `/uitleg` | New (`AppShell`) | Te auditen | P2 | |
| `/worklogs` | New (`AppShell`) | Te auditen | P1 | |
| `/admin/tenants` | Legacy (zonder shell) | Te auditen | P1 | Multi-tenant beheer |

## API-domeinen (globaal)

De 80 API-routes vallen primair onder:

- Auth/session
- Chat/AI/context
- Finance/import/rules
- Todos/projects/worklogs
- Journal/notes/memory
- Tenant/admin/debug

## Eigenaarschap en ritme

- **Architectuur-owner:** app maintainer (te bevestigen).
- **Review-cadans:** wekelijks tijdens release cut.
- **Bijwerken verplicht bij:** nieuwe route, shell-migratie, prioriteitswijziging.

## Werkwijze voor updates

1. Voeg route toe met shell-status en prioriteit.
2. Koppel uitkomst van pagina-audit (DoD + score).
3. Link bij P0/P1 naar issue/PR die actie draagt.

