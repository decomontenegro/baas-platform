"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, ArrowRight } from "lucide-react"

interface SetupStep {
  id: string
  title: string
  description: string
  completed: boolean
  current: boolean
}

export default function SetupWizardPage() {
  const [steps] = React.useState<SetupStep[]>([
    {
      id: "whatsapp",
      title: "WhatsApp",
      description: "Conectar WhatsApp",
      completed: false,
      current: true
    },
    {
      id: "llm",
      title: "LLM",
      description: "Configurar provider",
      completed: false,
      current: false
    },
    {
      id: "agent",
      title: "Agente", 
      description: "Definir persona",
      completed: false,
      current: false
    },
    {
      id: "test",
      title: "Testar",
      description: "Chat de teste",
      completed: false,
      current: false
    },
    {
      id: "deploy",
      title: "Deploy",
      description: "Ativar bot",
      completed: false,
      current: false
    }
  ])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Setup Wizard</h1>
          <p className="text-gray-600 mt-2">Configure seu bot em 5 passos simples</p>
        </div>

        {/* Steps Navigation */}
        <div className="flex items-center justify-center mb-8 space-x-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center space-x-2">
                {step.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : step.current ? (
                  <Circle className="w-6 h-6 text-blue-600 fill-blue-600" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-300" />
                )}
                <span className={`text-sm font-medium ${
                  step.current ? 'text-blue-600' : 
                  step.completed ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current Step Content */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📱</span>
              <span>WhatsApp</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Conectar WhatsApp</h3>
              <p className="text-gray-600 mb-4">
                Para conectar seu WhatsApp, use o comando no terminal:
              </p>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                clawdbot whatsapp link
              </div>
              <p className="text-gray-600 mt-2">
                Escaneie o QR code com seu WhatsApp para vincular.
              </p>
            </div>
            
            <div className="pt-4 border-t flex justify-between">
              <Button variant="outline" disabled>
                Anterior
              </Button>
              <Button>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}