# INTERNAL_API_KEY Setup Instructies

## Gegeven API Key
```
INTERNAL_API_KEY: daan_internal_api_2026_r7Nf4Qp2Lm8X
```

## Stap 1: Configureer INTERNAL_API_KEY in Vercel

### Via Vercel CLI
```bash
vercel env add INTERNAL_API_KEY

# Kies "Production" environment
# Plak deze exacte waarde:
daan_internal_api_2026_r7Nf4Qp2Lm8X
```

### Via Vercel Dashboard
1. Ga naar [vercel.com](https://vercel.com)
2. Selecteer project: "daans-persoonlijke-hulp"
3. Ga naar "Settings" tab
4. Klik op "Environment Variables"
5. Voeg toe:
   - **Name**: `INTERNAL_API_KEY`
   - **Value**: `daan_internal_api_2026_r7Nf4Qp2Lm8X`
   - **Environment**: `Production`
6. Save

## Stap 2: Test Telegram Setup

### Test API Call
```bash
curl -X POST "https://daans-persoonlijke-hulp.vercel.app/api/telegram/setup" \
  -H "Content-Type: application/json" \
  -H "x-api-key: daan_internal_api_2026_r7Nf4Qp2Lm8X" \
  -d '{}'
```

### Verwachte Response
```json
{
  "success": true,
  "webhookUrl": "https://daans-persoonlijke-hulp.vercel.app/api/telegram/webhook",
  "message": "Webhook configured successfully"
}
```

## Stap 3: PowerShell Alternative
```powershell
Invoke-RestMethod -Uri "https://daans-persoonlijke-hulp.vercel.app/api/telegram/setup" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{
    "x-api-key" = "daan_internal_api_2026_r7Nf4Qp2Lm8X"
  } `
  -Body '{}'
```

## Stap 4: Verificatie

Na setup:
1. **Test webhook**: Stuur een bericht naar je Telegram bot
2. **Check logs**: Geen 401 Unauthorized meer
3. **Verify webhook info**: Webhook moet correct zijn ingesteld

## Security Notes
- API key is al gegenereerd en veilig
- Alleen gebruiken voor interne API calls
- Niet delen of in code committen
- Vercel environment variables zijn encrypted

## Troubleshooting

### 401 Unauthorized
- Check of INTERNAL_API_KEY correct is gekopieerd
- Wacht 2-3 minuten voor Vercel propagation
- Test met curl command hierboven

### 500 Internal Server Error
- Check Vercel function logs
- Verify webhook secret is ook geconfigureerd
- Test met simpele request

### Webhook niet ingesteld
- Verifieer bot token is correct
- Check webhook permissions
- Probeer setup opnieuw

## Volgende Stappen

1. **Configureer API key** in Vercel
2. **Test setup** met curl command
3. **Verifieer bot werkt** in Telegram
4. **Monitor logs** voor errors

De INTERNAL_API_KEY is nu klaar voor gebruik!
