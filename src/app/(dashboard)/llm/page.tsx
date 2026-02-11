"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TokenCounterStat } from "@/components/llm"
import { UsageProgressBar } from "@/components/llm"
import { Loader2, AlertCircle, CheckCircle2, Circle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface OAuthAccount {
  id: string
  name: string
  active: boolean
  daily: { used: number; limit: number; percentage: number; remaining: string }
  weekly: { used: number; limit: number; percentage: number; remaining: string }
}

interface OAuthData {
  accounts: OAuthAccount[]
  autoSwitch: boolean
}

interface UsageData {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cost: number
  budget: number
  period: string
  lastUpdated: string | null
}

export default function LLMUsagePage() {
  const [data, setData] = React.useState<UsageData | null>(null)
  const [oauthData, setOauthData] = React.useState<OAuthData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [tracking, setTracking] = React.useState(true)

  React.useEffect(() => {
    async function fetchUsage() {
      try {
        const [usageRes, oauthRes] = await Promise.all([
          fetch('/api/clawdbot/usage'),
          fetch('/api/clawdbot/oauth-usage')
        ])
        const usageResult = await usageRes.json()
        const oauthResult = await oauthRes.json()
        
        if (usageResult.success && usageResult.data) {
          setData(usageResult.data)
          setTracking(usageResult.tracking !== false)
        }
        if (oauthResult.success && oauthResult.data) {
          setOauthData(oauthResult.data)
        }
      } catch (error) {
        console.error('Error fetching usage:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUsage()
  }, [])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const usageData = data || {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    budget: 0,
    period: 'current',
    lastUpdated: null
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consumo LLM</h1>
        <p className="text-muted-foreground">
          Dados reais de uso do Clawdbot LLM Gateway
        </p>
      </div>

      {!tracking && (
        <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Tracking de uso não configurado. Dados aparecerão quando requisições LLM forem feitas.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tokens Totais (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TokenCounterStat
              label=""
              tokens={usageData.totalTokens}
              inputTokens={usageData.inputTokens}
              outputTokens={usageData.outputTokens}
              costPerMillionInput={3}
              costPerMillionOutput={15}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${usageData.cost.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageData.budget > 0 ? (
              <UsageProgressBar
                current={usageData.cost}
                limit={usageData.budget}
                thresholds={{ warning: 70, danger: 90 }}
                formatValue={(v) => `$${v.toFixed(2)}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Sem limite definido</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Última Atualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {usageData.lastUpdated 
                ? new Date(usageData.lastUpdated).toLocaleString('pt-BR')
                : 'Sem dados ainda'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* OAuth Accounts Card */}
      {oauthData && oauthData.accounts.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              OAuth Accounts
              {oauthData.autoSwitch && (
                <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  Auto-switch ativo
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {oauthData.accounts.map((account) => (
                <div key={account.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {account.active ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium">{account.name}</span>
                    {account.active && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Ativo</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Diário</span>
                        <span>{account.daily.percentage}% restante ({account.daily.remaining})</span>
                      </div>
                      <Progress value={account.daily.percentage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Semanal</span>
                        <span>{account.weekly.percentage}% restante ({account.weekly.remaining})</span>
                      </div>
                      <Progress value={account.weekly.percentage} className="h-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Histórico de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            {tracking 
              ? 'Gráfico de histórico será exibido quando houver mais dados.'
              : 'Configure o tracking de uso para ver o histórico.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
