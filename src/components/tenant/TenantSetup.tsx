'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface TenantSetupData {
  tenant_name: string
  database_url: string
  telegram_bot_token: string
  telegram_bot_username: string
  user_name: string
  user_email: string
  telegram_user_id?: string
}

export function TenantSetup() {
  const [formData, setFormData] = useState<TenantSetupData>({
    tenant_name: '',
    database_url: '',
    telegram_bot_token: '',
    telegram_bot_username: '',
    user_name: '',
    user_email: '',
    telegram_user_id: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; tenant?: any } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/tenant/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_name: formData.tenant_name,
          database_url: formData.database_url,
          telegram_bot_token: formData.telegram_bot_token,
          telegram_bot_username: formData.telegram_bot_username,
          user_data: {
            name: formData.user_name,
            email: formData.user_email,
            telegram_user_id: formData.telegram_user_id
          }
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          tenant: data.tenant
        })
      } else {
        setResult({
          success: false,
          message: data.error || 'Setup failed'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error occurred'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof TenantSetupData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  if (result?.success) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            Tenant Setup Voltooid
          </CardTitle>
          <CardDescription>
            {result.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Volgende stappen:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Telegram bot @{result.tenant.telegram_bot_username} is nu actief</li>
                  <li>Database schema is geïnitialiseerd</li>
                  <li>Gebruiker {formData.user_name} is aangemaakt</li>
                  <li>Start met chatten via de Telegram bot</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Connection Details:</h4>
              <div className="text-sm space-y-1">
                <p><strong>Tenant ID:</strong> {result.tenant.id}</p>
                <p><strong>Database:</strong> {formData.database_url.substring(0, 50)}...</p>
                <p><strong>Bot Username:</strong> @{result.tenant.telegram_bot_username}</p>
              </div>
            </div>

            <Button 
              onClick={() => window.open(`https://t.me/${result.tenant.telegram_bot_username}`, '_blank')}
              className="w-full"
            >
              Open Telegram Bot
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Multi-Tenant Setup</CardTitle>
        <CardDescription>
          Maak een nieuwe tenant aan voor broer of vriendin met eigen database en Telegram bot
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tenant Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tenant Informatie</h3>
            
            <div>
              <Label htmlFor="tenant_name">Tenant Naam</Label>
              <Input
                id="tenant_name"
                value={formData.tenant_name}
                onChange={handleInputChange('tenant_name')}
                placeholder="bv. broer, vriendin"
                required
              />
            </div>

            <div>
              <Label htmlFor="database_url">Database URL</Label>
              <Input
                id="database_url"
                value={formData.database_url}
                onChange={handleInputChange('database_url')}
                placeholder="postgresql://user:pass@host:port/database"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                PostgreSQL connection string voor deze tenant
              </p>
            </div>
          </div>

          {/* Telegram Bot Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Telegram Bot Configuratie</h3>
            
            <div>
              <Label htmlFor="telegram_bot_token">Bot Token</Label>
              <Input
                id="telegram_bot_token"
                value={formData.telegram_bot_token}
                onChange={handleInputChange('telegram_bot_token')}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Token van @BotFather
              </p>
            </div>

            <div>
              <Label htmlFor="telegram_bot_username">Bot Username</Label>
              <Input
                id="telegram_bot_username"
                value={formData.telegram_bot_username}
                onChange={handleInputChange('telegram_bot_username')}
                placeholder="broer_personal_bot"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Username zonder @ prefix
              </p>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Gebruiker Informatie</h3>
            
            <div>
              <Label htmlFor="user_name">Naam</Label>
              <Input
                id="user_name"
                value={formData.user_name}
                onChange={handleInputChange('user_name')}
                placeholder="Volledige naam"
                required
              />
            </div>

            <div>
              <Label htmlFor="user_email">Email (optioneel)</Label>
              <Input
                id="user_email"
                type="email"
                value={formData.user_email}
                onChange={handleInputChange('user_email')}
                placeholder="email@example.com"
              />
            </div>

            <div>
              <Label htmlFor="telegram_user_id">Telegram User ID (optioneel)</Label>
              <Input
                id="telegram_user_id"
                value={formData.telegram_user_id}
                onChange={handleInputChange('telegram_user_id')}
                placeholder="123456789"
              />
              <p className="text-sm text-gray-500 mt-1">
                Via @userinfobot op Telegram
              </p>
            </div>
          </div>

          {/* Error Display */}
          {result && !result.success && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setup wordt uitgevoerd...
              </>
            ) : (
              'Maak Tenant Aan'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
