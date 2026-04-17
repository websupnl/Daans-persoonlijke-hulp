# CRON_SECRET Update Instructies

## Stap 1: Update CRON_SECRET in Vercel

### Methode A: Vercel CLI
```bash
# Update de CRON_SECRET
vercel env add CRON_SECRET

# Kies "Production" environment
# Plak deze exacte waarde:
260acc7c8b76fbfa1d3d4363e0d20c65d124aecb2ff9b98c8d10fa66d09ddd9d
```

### Methode B: Vercel Dashboard
1. Ga naar [vercel.com](https://vercel.com)
2. Selecteer project: "daans-persoonlijke-hulp"
3. Ga naar "Settings" tab
4. Klik op "Environment Variables"
5. Zoek "CRON_SECRET" en klik edit
6. Update waarde naar:
   ```
   260acc7c8b76fbfa1d3d4363e0d20c65d124aecb2ff9b98c8d10fa66d09ddd9d
   ```
7. Save

## Stap 2: Test de Fix

### Direct Test
```bash
curl "https://daans-persoonlijke-hulp.vercel.app/api/cron/pulse?secret=260acc7c8b76fbfa1d3d4363e0d20c65d124aecb2ff9b98c8d10fa66d09ddd9d"
```

### Verwachte Response
```json
{
  "ok": true,
  "status": "message_sent",
  "duration": 15000,
  "timestamp": "2026-04-18T00:00:00.000Z",
  "results": { ... }
}
```

## Stap 3: Monitor cron-job.org

Na de update:
- cron-job.org execution history zou "200 OK" moeten tonen
- Geen "401 Unauthorized" meer
- Telegram messages worden weer verstuurd

## Belangrijk

- Gebruik de **exacte secret** uit de cronjob log
- Geen extra spaties of newlines
- Environment type: "Production"
- Redeploy is niet nodig na environment variable update

## Troubleshooting

Als het nog steeds 401 geeft:
1. Check of de secret exact is gekopieerd
2. Wacht 2-3 minuten voor Vercel propagation
3. Test met curl zoals hierboven
4. Check Vercel function logs

De cronjob zou na deze update direct moeten werken!
