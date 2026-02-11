"use client"

import * as React from "react"
import { AlertCard, type Alert } from "@/components/llm"
import { Loader2, CheckCircle2 } from "lucide-react"

export default function LLMAlertsPage() {
  const [alerts, setAlerts] = React.useState<Alert[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch('/api/clawdbot/alerts')
        const data = await res.json()
        if (data.success) {
          setAlerts(data.data.map((a: Alert & { createdAt: string }) => ({
            ...a,
            createdAt: new Date(a.createdAt)
          })))
        }
      } catch (error) {
        console.error('Error fetching alerts:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAlerts()
  }, [])

  const handleAcknowledge = (id: string) => {
    console.log("Acknowledge:", id)
  }

  const handleDismiss = (id: string) => {
    console.log("Dismiss:", id)
  }

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
        <h1 className="text-2xl font-bold">Alertas</h1>
        <p className="text-muted-foreground">
          Monitore alertas de uso, budget e status dos providers
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
          <h3 className="text-lg font-medium">Tudo certo!</h3>
          <p className="text-muted-foreground">Nenhum alerta ativo no momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  )
}
