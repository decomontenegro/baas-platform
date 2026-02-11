"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TokenCounterStat } from "@/components/llm"
import { UsageProgressBar } from "@/components/llm"
import { Loader2, AlertCircle } from "lucide-react"

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
  const [isLoading, setIsLoading] = React.useState(true)
  const [tracking, setTracking] = React.useState(true)

  React.useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/clawdbot/usage')
        const result = await res.json()
        if (result.success && result.data) {
          setData(result.data)
          setTracking(result.tracking !== false)
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
                current={usageData.totalTokens}
                limit={usageData.budget}
                thresholds={{ warning: 70, danger: 90 }}
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

      <Card>
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
