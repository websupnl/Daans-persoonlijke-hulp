'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Users, Database, Bot, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { TenantSetup } from '@/components/tenant/TenantSetup'

interface Tenant {
  id: string
  name: string
  database_url: string
  telegram_bot_username: string
  is_active: boolean
  created_at: string
  database_status?: boolean
  bot_status?: boolean
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenant/list')
      if (response.ok) {
        const data = await response.json()
        setTenants(data.tenants)
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshTenants = async () => {
    setRefreshing(true)
    await fetchTenants()
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  if (showSetup) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setShowSetup(false)}
          >
            Terug naar Tenants
          </Button>
        </div>
        <TenantSetup />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Multi-Tenant Beheer</h1>
          <p className="text-gray-600">Beheer tenants voor broer en vriendin</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshTenants}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button onClick={() => setShowSetup(true)}>
            Nieuwe Tenant
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.filter(t => t.is_active).length}</div>
            <p className="text-xs text-muted-foreground">
              Actieve gebruikers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.filter(t => t.database_status !== false).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Verbonden databases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.filter(t => t.bot_status !== false).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Actieve Telegram bots
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenants Overzicht</CardTitle>
          <CardDescription>
            Alle actieve tenants met hun status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Geen tenants gevonden</h3>
              <p className="text-gray-600 mb-4">
                Maak je eerste tenant aan om te beginnen
              </p>
              <Button onClick={() => setShowSetup(true)}>
                Maak Eerste Tenant Aan
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Bot Username</TableHead>
                  <TableHead>Database</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-sm text-gray-500">{tenant.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        <span>@{tenant.telegram_bot_username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span className="text-sm">
                          {tenant.database_url.split('@')[1]?.split('/')[0] || 'Local'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                          {tenant.is_active ? 'Actief' : 'Inactief'}
                        </Badge>
                        {tenant.database_status !== false && (
                          <Badge variant="outline" className="text-green-600">
                            DB OK
                          </Badge>
                        )}
                        {tenant.bot_status !== false && (
                          <Badge variant="outline" className="text-green-600">
                            Bot OK
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(tenant.created_at).toLocaleDateString('nl-NL')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`https://t.me/${tenant.telegram_bot_username}`, '_blank')}
                        >
                          Open Bot
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Nieuwe Tenant Setup:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Maak een nieuwe PostgreSQL database aan</li>
                  <li>Creeer een Telegram bot via @BotFather</li>
                  <li>Vind het Telegram User ID via @userinfobot</li>
                  <li>Vul het formulier in en klik op &ldquo;Maak Tenant Aan&rdquo;</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Belangrijk:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Elke tenant krijgt een volledig geïsoleerde database</li>
                  <li>Data wordt nooit gedeeld tussen tenants</li>
                  <li>Elke tenant heeft zijn eigen Telegram bot instance</li>
                  <li>Gebruikers kunnen alleen hun eigen data zien</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
