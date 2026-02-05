"use client"

import * as React from "react"
import { AlertCard, type Alert } from "@/components/llm"

export default function LLMAlertsPage() {
  // TODO: Replace with real data from API
  const mockAlerts: Alert[] = [
    {
      id: "1",
      title: "Budget 90% atingido",
      message: "O consumo mensal atingiu 90% do limite configurado. Considere aumentar o budget ou revisar o uso.",
      severity: "warning",
      status: "active",
      type: "budget",
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    },
    {
      id: "2",
      title: "Provider Google AI degradado",
      message: "O provider Google AI está com latência elevada. Algumas requisições podem estar lentas.",
      severity: "warning",
      status: "acknowledged",
      type: "provider",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      id: "3",
      title: "Rate limit OpenAI atingido",
      message: "O rate limit do OpenAI foi atingido temporariamente. Requisições foram enfileiradas.",
      severity: "info",
      status: "resolved",
      type: "rate_limit",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
  ]

  const handleAcknowledge = (id: string) => {
    console.log("Acknowledge:", id)
  }

  const handleDismiss = (id: string) => {
    console.log("Dismiss:", id)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alertas</h1>
        <p className="text-muted-foreground">
          Monitore alertas de uso, budget e status dos providers
        </p>
      </div>

      <div className="space-y-4">
        {mockAlerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={handleAcknowledge}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  )
}
