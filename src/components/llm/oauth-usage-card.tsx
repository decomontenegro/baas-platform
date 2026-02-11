"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"

interface OAuthAccount {
  id: string
  name: string
  file: string
  active: boolean
  daily: {
    used: number
    total: number
    remaining: number
  }
  weekly: {
    used: number
    total: number
    remaining: number
  }
}

interface OAuthUsageData {
  accounts: OAuthAccount[]
  lastUpdated: string
  autoSwitch: boolean
}

export function OAuthUsageCard() {
  const [data, setData] = React.useState<OAuthUsageData | null>(null)
  const [loading, setLoading] = React.useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/llm/oauth-usage')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch OAuth usage:', error)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Contas OAuth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando limites...</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contas OAuth</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contas OAuth</CardTitle>
        <div className="flex items-center gap-2">
          {data.autoSwitch && (
            <Badge variant="secondary" className="text-xs">
              Auto-switch ✓
            </Badge>
          )}
          <button 
            onClick={fetchData}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.accounts.map((account) => (
          <div key={account.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${account.active ? 'bg-green-500' : 'bg-blue-500'}`} />
                <span className="text-sm font-medium">{account.name}</span>
                {account.active && (
                  <Badge variant="outline" className="text-xs">
                    Ativa
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{account.file}</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Diário</span>
                <span>{account.daily.remaining}% restante</span>
              </div>
              <Progress value={account.daily.remaining} className="h-1" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Semanal</span>
                <span>{account.weekly.remaining}% restante</span>
              </div>
              <Progress value={account.weekly.remaining} className="h-1" />
            </div>
          </div>
        ))}
        
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date(data.lastUpdated).toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}