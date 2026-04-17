# Multi-Tenant Setup voor Broer

## Overzicht
Deze document beschrijft hoe je broer de app kan uitproberen met zijn eigen database en configuratie, zonder dat dit conflicteert met jouw setup.

## Architectuur

### 1. Database Strategie
- **Jouw setup**: Eén database met jouw data
- **Broer setup**: Aparte database voor zijn data
- **Isolatie**: Volledig gescheiden data, geen conflicten

### 2. Environment Configuratie
Gebruik environment variables om de juiste database te selecteren:

```bash
# Jouw setup (default)
DATABASE_URL=postgresql://user:pass@host:5432/daan_db
TENANT_ID=daan

# Broer setup
DATABASE_URL=postgresql://user:pass@host:5432/broer_db
TENANT_ID=broer
```

### 3. Deployment Strategie

#### Optie A: Aparte Vercel Project (Aanbevolen)
```bash
# 1. Broer clone de repo
git clone https://github.com/websupnl/Daans-persoonlijke-hulp.git broer-app

# 2. Zijn eigen environment variables instellen in Vercel
# DATABASE_URL, TENANT_ID, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, etc.

# 3. Deployen naar eigen Vercel account
vercel --prod
```

#### Optie B: Multi-tenant in één Project (Geavanceerd)
```bash
# Environment based tenant routing
DATABASE_URL_DAAN=postgresql://...
DATABASE_URL_BROER=postgresql://...
```

## Implementatie Stappen

### Stap 1: Database Configuratie
```typescript
// src/lib/db.ts
const getDatabaseConfig = () => {
  const tenantId = process.env.TENANT_ID || 'daan'
  
  const configs = {
    daan: {
      connectionString: process.env.DATABASE_URL_DAAN || process.env.DATABASE_URL,
      schema: 'daan_schema'
    },
    broer: {
      connectionString: process.env.DATABASE_URL_BROER,
      schema: 'broer_schema'
    }
  }
  
  return configs[tenantId] || configs.daan
}

export const pool = new Pool(getDatabaseConfig())
```

### Stap 2: Environment Variables
```bash
# .env.local
TENANT_ID=broer
DATABASE_URL=postgresql://broer_user:pass@host:5432/broer_db
OPENAI_API_KEY=broer_openai_key
TELEGRAM_BOT_TOKEN=broer_bot_token
TELEGRAM_CHAT_ID=broer_chat_id
```

### Stap 3: Schema Isolatie
```sql
-- Gebruik verschillende schemas voor isolatie
CREATE SCHEMA IF NOT EXISTS daan_schema;
CREATE SCHEMA IF NOT EXISTS broer_schema;

-- Tabellen in specifieke schemas
CREATE TABLE daan_schema.todos (...);
CREATE TABLE broer_schema.todos (...);
```

### Stap 4: Deployment Configuratie
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "TENANT_ID": {
      "description": "Tenant identifier",
      "value": "daan"
    }
  }
}
```

## Voordelen

### ✅ Voordelen voor Broer
- **Volledig geïsoleerd**: Eigen data, geen conflicten
- **Eigen AI**: Kan eigen OpenAI key gebruiken
- **Eigen Telegram**: Aparte bot voor zijn notificaties
- **Experimenteervrij**: Kan features testen zonder jouw setup te beïnvloeden

### ✅ Voordelen voor Jouw Setup
- **Geen conflicten**: Data blijft gescheiden
- **Geïsoleerde testomgeving**: Broer kan veilig experimenteren
- **Code sharing**: Jullie kunnen code delen zonder data conflicten

## Test Plan

### Fase 1: Voorbereiding
1. Broer clone de repo naar eigen folder
2. Zet zijn environment variables in `.env.local`
3. Test lokaal met `npm run dev`

### Fase 2: Deployment
1. Maak nieuw Vercel project voor broer
2. Configureer environment variables in Vercel dashboard
3. Deploy en test productie

### Fase 3: Validatie
1. Test alle functionaliteiten (todos, finance, AI, etc.)
2. Verifieer data isolatie
3. Test Telegram integratie

## Overwegingen

### ⚠️ Belangrijke Aandachtspunten
- **AI Keys**: Ieder zijn eigen OpenAI key nodig
- **Database Costs**: Twee databases = dubbele kosten
- **Feature Pariteit**: Nieuwe features moeten in beide setups werken
- **Backup**: Regelmatige backups voor beide databases

### 🔧 Technische Implementatie
- Gebruik environment-based routing
- Implementeer tenant-aware middleware
- Schema-per-tenant voor volledige isolatie
- Shared codebase, gescheiden data

## Volgende Stappen
1. Kies deployment strategie (A of B)
2. Implementeer basis multi-tenant support
3. Test met broer
4. Documenteer proces voor toekomstige gebruikers
