# Broer Toegang Instructies

## Overzicht
Complete handleiding voor broer om toegang te krijgen tot de app met eigen credentials.

## Stap 1: Clone en Setup

### Clone Repository
```bash
git clone https://github.com/websupnl/Daans-persoonlijke-hulp.git broer-app
cd broer-app
```

### Configureer Environment
Maak `.env.local` aan met broer's credentials:

```bash
# Multi-tenant configuratie
TENANT_ID=broer

# Broer's database
DATABASE_URL=postgresql://broer_user:password@host:5432/broer_db

# Broer's authenticatie
AUTH_ADMIN_PASSWORD_HASH_BROER=<broer_wachtwoord_hash>
AUTH_DEVICE_PIN_HASH_BROER=<broer_pin_hash>

# Broer's API keys
OPENAI_API_KEY=<broer_openai_key>
TELEGRAM_BOT_TOKEN=<broer_telegram_bot>
TELEGRAM_CHAT_ID=<broer_telegram_chat_id>
TELEGRAM_WEBHOOK_SECRET=<broer_webhook_secret>
INTERNAL_API_KEY=<broer_internal_api_key>
```

## Stap 2: Genereren van Password Hash

### Wachtwoord Hash Genereren
```bash
# Installeer bcrypt als je het nog niet hebt
npm install bcrypt

# Genereer hash voor broer's wachtwoord
node -e "
const bcrypt = require('bcrypt');
const password = 'broer_wachtwoord_hier';
const hash = bcrypt.hashSync(password, 12);
console.log('Password hash:', hash);
"
```

### PIN Hash Genereren
```bash
# Genereer hash voor 4-cijferige PIN
node -e "
const bcrypt = require('bcrypt');
const pin = '1234';  // Vervang met broer's PIN
const hash = bcrypt.hashSync(pin, 12);
console.log('PIN hash:', hash);
"
```

## Stap 3: Lokale Test

### Installatie en Starten
```bash
npm install
npm run dev
```

### Toegang Testen
1. Open browser naar `http://localhost:3000`
2. Login met broer's credentials
3. Test alle functionaliteiten

## Stap 4: Deployment

### Optie A: Eigen Vercel Project
```bash
# Login bij Vercel met broer's account
vercel login

# Deploy de app
vercel --prod

# Configureer environment variables in Vercel dashboard
# - TENANT_ID=broer
# - DATABASE_URL=<broer_database_url>
# - AUTH_ADMIN_PASSWORD_HASH_BROER=<hash>
# - AUTH_DEVICE_PIN_HASH_BROER=<hash>
# - OPENAI_API_KEY=<broer_openai_key>
# - etc.
```

### Optie B: Subdomein
```bash
# Deploy naar subdomein zoals broer.daanspersoonlijkehulp.nl
vercel --prod --name broer-app
```

## Stap 5: Validatie

### Functionaliteiten Testen
- [ ] Login met broer credentials
- [ ] Dashboard laden
- [ ] Todos aanmaken/beheren
- [ ] Transacties toevoegen
- [ ] AI features testen
- [ ] Telegram integratie
- [ ] Patroon analyse

### Data Isolatie Verifiëren
```sql
-- Controleer of broer data in eigen database staat
SELECT COUNT(*) FROM todos WHERE created_at >= NOW() - INTERVAL '1 day';
```

## Beveiliging

### 🔐 Belangrijke Aandachtspunten
1. **Unieke Credentials**: Broer gebruikt compleet andere wachtwoorden
2. **Gescheiden Database**: Volledig geïsoleerde data
3. **Eigen API Keys**: Aparte OpenAI en Telegram keys
4. **Environment Variables**: Nooit in Git committen!

### 🔧 Technical Security
- Hashes gebruiken voor wachtwoorden (nooit plain text)
- Environment variables in Vercel dashboard
- HTTPS verplicht voor production
- Regular database backups

## Troubleshooting

### Probleem: Login werkt niet
```bash
# Check environment variables
echo $TENANT_ID
echo $AUTH_ADMIN_PASSWORD_HASH_BROER

# Check database connectie
psql $DATABASE_URL -c "SELECT 1;"
```

### Probleem: Database fouten
```bash
# Check of tabellen bestaan
psql $DATABASE_URL -c "\dt"

# Run schema migratie
npm run db:migrate
```

### Probleem: AI features werken niet
```bash
# Check OpenAI key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

## Support

### Voor Daan
- Broer kan onafhankelijk experimenteren
- Geen impact op jouw data
- Code blijft gedeeld voor verbeteringen

### Voor Broer
- Volledige toegang tot alle features
- Eigen data en configuratie
- Mogelijkheid om eigen AI keys te gebruiken

## Volgende Stappen

1. Genereer secure hashes voor broer's credentials
2. Configureer `.env.local` bestand
3. Test lokaal met `npm run dev`
4. Deploy naar eigen Vercel account
5. Valideer alle functionaliteiten
