# Vercel Environment Variables Setup voor Cronjob

## Stap 1: CRON_SECRET Toevoegen aan Vercel

### Via Vercel CLI
```bash
# Genereer een secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Voeg toe aan Vercel environment
vercel env add CRON_SECRET

# Kies "Production" environment
# Plak de generated secret
```

### Via Vercel Dashboard
1. Ga naar [vercel.com](https://vercel.com)
2. Selecteer je project: "daans-persoonlijke-hulp"
3. Ga naar "Settings" tab
4. Klik op "Environment Variables"
5. Voeg toe:
   - **Name**: `CRON_SECRET`
   - **Value**: `<jouw_generated_secret>`
   - **Environment**: `Production`

## Stap 2: Verifieer Environment Variables

### Check via CLI
```bash
# Lijst alle environment variables
vercel env ls

# Specifiek checken
vercel env pull .env.production
```

### Check in Code
```bash
# Test endpoint om environment te checken
curl "https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=<jouw_secret>"
```

## Stap 3: Update cron-job.org Configuratie

### Nieuwe URL met Query Parameter
```
https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=<jouw_cron_secret>
```

### In cron-job.org Dashboard
1. Login bij [cron-job.org](https://cron-job.org)
2. Selecteer je cronjob
3. Klik op "Edit"
4. Update de URL naar bovenstaande met jouw secret
5. Save de wijzigingen

## Stap 4: Validatie

### Test de Fix
```bash
# Direct test
curl "https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=<jouw_cron_secret>"

# Verwachte response:
{
  "ok": true,
  "status": "message_sent",
  "duration": 15000,
  "timestamp": "2026-04-18T00:00:00.000Z",
  "results": { ... }
}
```

### Monitor cron-job.org
- Check execution history
- Zou nu "200 OK" moeten tonen
- Geen "401 Unauthorized" meer

## Security Best Practices

### Secret Management
```bash
# Genereer altijd nieuwe secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Nooit secrets in Git committen
# Gebruik altijd Vercel environment variables
```

### Environment Types
- **Production**: Voor live cronjob
- **Preview**: Voor testing (optioneel)
- **Development**: Voor lokaal testen

## Troubleshooting

### Error: 401 Unauthorized
```bash
# Check of secret correct is ingesteld
vercel env ls

# Test met verschillende formaten
curl "https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=test"
```

### Error: Environment variable niet gevonden
```bash
# Forceer redeploy na environment variable update
vercel --prod

# Of via Vercel dashboard: Settings -> General -> Redeploy
```

### Error: 500 Internal Server Error
```bash
# Check Vercel function logs
vercel logs

# Of in Vercel dashboard: Functions -> Logs
```

## Volgende Stappen

1. **Genereer CRON_SECRET**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. **Voeg toe aan Vercel**: Settings -> Environment Variables
3. **Update cron-job.org URL**: Met query parameter
4. **Test de fix**: Direct API call
5. **Monitor execution**: cron-job.org history

Na deze stappen werkt de cronjob weer correct!
