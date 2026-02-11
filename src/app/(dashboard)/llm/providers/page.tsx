"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderStatusBadge, type ProviderStatus } from "@/components/llm"
import { Loader2 } from "lucide-react"

interface RealProvider {
  id: string
  name: string
  status: ProviderStatus
  models: number
  modelList?: string[]
}

export default function LLMProvidersPage() {
  const [providers, setProviders] = React.useState<RealProvider[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/clawdbot/providers')
        const data = await res.json()
        if (data.success && data.data) {
          setProviders(data.data)
        }
      } catch (error) {
        console.error('Error fetching providers:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProviders()
  }, [])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-muted-foreground">
          Provedores de LLM reais do Clawdbot
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <Card key={provider.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <ProviderStatusBadge status={provider.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {provider.models} modelos disponíveis
              </p>
              {provider.modelList && provider.modelList.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {provider.modelList.slice(0, 3).join(', ')}
                  {provider.modelList.length > 3 && '...'}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {providers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum provider configurado
        </div>
      )}
    </div>
  )
}
