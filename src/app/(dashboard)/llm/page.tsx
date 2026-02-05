"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TokenCounterStat } from "@/components/llm"
import { UsageProgressBar } from "@/components/llm"

export default function LLMUsagePage() {
  // TODO: Replace with real data from API
  const mockData = {
    totalTokens: 12500000,
    inputTokens: 8500000,
    outputTokens: 4000000,
    budget: 15000000,
    cost: 125.50,
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consumo LLM</h1>
        <p className="text-muted-foreground">
          Acompanhe o uso de tokens e custos do LLM Gateway
        </p>
      </div>

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
              tokens={mockData.totalTokens}
              inputTokens={mockData.inputTokens}
              outputTokens={mockData.outputTokens}
              costPerMillionInput={3}
              costPerMillionOutput={15}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageProgressBar
              current={mockData.totalTokens}
              limit={mockData.budget}
              thresholds={{ warning: 70, danger: 90 }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Gráfico de uso será implementado aqui...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
