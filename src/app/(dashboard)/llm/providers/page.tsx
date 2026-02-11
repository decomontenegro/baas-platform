"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderStatusBadge, OAuthUsageCard, type ProviderStatus } from "@/components/llm"

interface MockProvider {
  id: string
  name: string
  status: ProviderStatus
  models: number
}

export default function LLMProvidersPage() {
  // TODO: Replace with real data from API
  const mockProviders: MockProvider[] = [
    { id: "1", name: "OpenAI", status: "active", models: 5 },
    { id: "2", name: "Anthropic", status: "active", models: 3 },
    { id: "3", name: "Google AI", status: "degraded", models: 2 },
    { id: "4", name: "Azure OpenAI", status: "disabled", models: 4 },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-muted-foreground">
          Gerencie os provedores de LLM conectados
        </p>
      </div>

      {/* OAuth Usage Card */}
      <div className="max-w-md">
        <OAuthUsageCard />
      </div>

      {/* Providers Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Providers Configurados</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockProviders.map((provider) => (
            <Card key={provider.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{provider.name}</CardTitle>
                <ProviderStatusBadge status={provider.status} />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {provider.models} modelos disponíveis
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
