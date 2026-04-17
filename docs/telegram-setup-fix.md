# Telegram Setup 401 Error Fix

## Probleem
De Telegram setup API geeft een 401 Unauthorized error bij het aanroepen van `/api/telegram/setup`.

## Oorzaak
De API vereist een `x-api-key` header met de `INTERNAL_API_KEY` environment variable, maar deze wordt niet meegestuurd in het request.

## Oplossing

### Stap 1: Controleer INTERNAL_API_KEY
```bash
# Check of INTERNAL_API_KEY is ingesteld in Vercel
echo $INTERNAL_API_KEY

# Of via Vercel CLI
vercel env ls
```

### Stap 2: Correcte API Call
```bash
# PowerShell (Windows)
$headers = @{
    "x-api-key" = "jouw_interne_api_key_hier"
    "Content-Type" = "application/json"
}
$body = @{
    webhookUrl = "https://daans-persoonlijke-hulp.vercel.app/api/telegram/webhook"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://daans-persoonlijke-hulp.vercel.app/api/telegram/setup" `
                -Method POST `
                -Headers $headers `
                -Body $body

# Curl alternatief
curl -X POST "https://daans-persoonlijke-hulp.vercel.app/api/telegram/setup" \
     -H "x-api-key: jouw_interne_api_key_hier" \
     -H "Content-Type: application/json" \
     -d '{"webhookUrl": "https://daans-persoonlijke-hulp.vercel.app/api/telegram/webhook"}'
```

### Stap 3: Environment Variables Configureren
In Vercel dashboard of via CLI:

```bash
# Voeg INTERNAL_API_KEY toe aan Vercel environment
vercel env add INTERNAL_API_KEY

# Of in .env.local voor lokale testing
INTERNAL_API_KEY=jouw_interne_api_key_hier
```

### Stap 4: Test Webhook Status
```bash
# Check huidige webhook status
curl -X GET "https://daans-persoonlijke-hulp.vercel.app/api/telegram/setup" \
     -H "x-api-key: jouw_interne_api_key_hier"
```

## Security

### API Key Generatie
```bash
# Genereer een secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Best Practices
- Gebruik een lange, random string voor INTERNAL_API_KEY
- Sla de key op in Vercel environment variables, niet in code
- Gebruik HTTPS voor alle API calls
- Log nooit API keys in logs of console output

## Troubleshooting

### Error: 401 Unauthorized
- Check of `x-api-key` header is meegestuurd
- Verifieer dat de key overeenkomt met `INTERNAL_API_KEY`
- Ensure environment variable is set in production

### Error: 500 Internal Server Error
- Check of `TELEGRAM_BOT_TOKEN` is ingesteld
- Verifieer webhook URL is bereikbaar
- Check Vercel function logs voor details

### Error: Webhook setup failed
- Controleer Telegram bot token validiteit
- Verifieer webhook URL is HTTPS en publiek bereikbaar
- Check Telegram Bot API rate limits

## Validatie

Na setup, test de webhook:

```bash
# Test webhook door een bericht te sturen naar je bot
# Of via Telegram Bot API:
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Succesvolle response zou moeten tonen:
```json
{
  "ok": true,
  "result": {
    "url": "https://daans-persoonlijke-hulp.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query"]
  }
}
```
