# Cronjob 401 Unauthorized Error Fix

## Probleem
De cronjob op `/api/cron/pulse` geeft een 401 Unauthorized error sinds 21:00 uur gisteren.

## Oorzaak
De cronjob API vereist een `Authorization: Bearer <CRON_SECRET>` header, maar cron-job.org stuurt deze niet mee.

## Oplossing

### Stap 1: Controleer CRON_SECRET
```bash
# Check of CRON_SECRET is ingesteld in Vercel
vercel env ls

# Of check in Vercel dashboard
# Environment Variables -> CRON_SECRET
```

### Stap 2: Genereer Nieuwe Secret (indien nodig)
```bash
# Genereer een secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Stap 3: Update cron-job.org Configuratie

#### Optie A: Custom Headers toevoegen
In cron-job.org dashboard:
1. Ga naar je cronjob
2. Edit de job
3. Voeg "Custom Headers" toe:
   - Header: `Authorization`
   - Value: `Bearer <jouw_cron_secret>`

#### Optie B: Update URL met query parameter (alternatief)
Als custom headers niet werken:
```
https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=<jouw_cron_secret>
```

En update de API code om query parameter te accepteren:
```typescript
// In src/app/api/cron/pulse/route.ts
const urlSecret = request.nextUrl.searchParams.get('secret')
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET
const hasValidCronSecret = !!(cronSecret && (
  authHeader === `Bearer ${cronSecret}` || 
  urlSecret === cronSecret
))
```

### Stap 4: Test de Fix
```bash
# Test met Bearer token
curl -H "Authorization: Bearer <jouw_cron_secret>" \
     "https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse"

# Of met query parameter
curl "https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=<jouw_cron_secret>"
```

## API Code Analyse

De huidige code verwacht:
```typescript
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET
const hasValidCronSecret = !!(cronSecret && authHeader === `Bearer ${cronSecret}`)
```

Dit betekent dat cron-job.org een `Authorization: Bearer <secret>` header moet meesturen.

## cron-job.org Configuratie

### Methode 1: Custom Headers (Aanbevolen)
1. Login bij cron-job.org
2. Selecteer je cronjob
3. Klik op "Edit"
4. Bij "Custom Headers" voeg toe:
   - Name: `Authorization`
   - Value: `Bearer <jouw_cron_secret>`

### Methode 2: Query Parameter
Als custom headers niet ondersteund worden:
1. Update de cronjob URL naar:
   ```
   https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=<jouw_cron_secret>
   ```
2. Update de API code om query parameter te accepteren (zie hierboven)

## Security

### Secret Management
- Gebruik een lange, random string voor CRON_SECRET
- Sla op in Vercel environment variables
- Nooit in code of Git committen
- Rotate secret indien nodig

### Beveiligingstips
```bash
# Genereer secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Test secret validiteit
echo $CRON_SECRET  # Moet niet leeg zijn
```

## Troubleshooting

### Error: 401 Unauthorized
- Check CRON_SECRET is ingesteld in Vercel
- Verifieer Authorization header format: `Bearer <secret>`
- Test met curl om te valideren

### Error: 500 Internal Server Error
- Check Vercel function logs
- Verifieer environment variables
- Test API endpoint handmatig

### Error: Timeout
- Cronjob duurt >30 seconden (limit van cron-job.org)
- Check performance van AI calls
- Overweeg timeout verhoging

## Monitoring

### Na Fix
1. Monitor cron-job.org execution history
2. Check Vercel function logs
3. Valideer Telegram messages worden verstuurd

### Expected Response
```json
{
  "ok": true,
  "status": "message_sent",
  "duration": 15000,
  "timestamp": "2026-04-18T00:00:00.000Z",
  "results": {
    "observations": { "updated": true },
    "proactive": { "triggered": true, "telegramSent": true }
  }
}
```

## Validatie Checklist

- [ ] CRON_SECRET is ingesteld in Vercel
- [ ] cron-job.org heeft correcte Authorization header
- [ ] API endpoint reageert met 200 OK
- [ ] Telegram messages worden verstuurd
- [ ] Geen 401 errors in execution history

De cronjob zou na deze fix weer correct moeten werken!
