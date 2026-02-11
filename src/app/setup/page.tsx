"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, ArrowRight, Loader2, Smartphone } from "lucide-react"

interface SetupStep {
  id: string
  title: string
  description: string
  completed: boolean
  current: boolean
}

interface WhatsAppStatus {
  connected: boolean
  phone?: string | null
  name?: string | null
  lastSeen?: string | null
}

export default function SetupWizardPage() {
  const [steps, setSteps] = React.useState<SetupStep[]>([
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

  const [connectionStatus, setConnectionStatus] = React.useState<WhatsAppStatus | null>(null)
  const [isChecking, setIsChecking] = React.useState(false)
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null)

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/clawdbot/whatsapp/link')
      const data = await response.json()
      
      if (data.success) {
        setConnectionStatus(data.data)
        setLastChecked(new Date())
        
        // Update steps if connected
        if (data.data.connected) {
          setSteps(prev => prev.map(step => 
            step.id === 'whatsapp' 
              ? { ...step, completed: true, current: false }
              : step.id === 'llm'
              ? { ...step, current: true }
              : step
          ))
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error)
    } finally {
      setIsChecking(false)
    }
  }

  // Auto-check on mount
  React.useEffect(() => {
    checkConnection()
  }, [])

  const currentStepIndex = steps.findIndex(step => step.current)
  const canProceed = connectionStatus?.connected || false

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Setup Wizard</h1>
          <p className="text-gray-600 mt-2">Configure seu bot em 5 passos simples</p>
        </div>

        {/* Steps Navigation */}
        <div className="flex items-center justify-center mb-8 space-x-2 flex-wrap">
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
              <Smartphone className="w-5 h-5" />
              <span>WhatsApp</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Status */}
            {connectionStatus && (
              <div className={`p-4 rounded-lg border ${
                connectionStatus.connected 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center space-x-2">
                  {connectionStatus.connected ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Conectado!</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Aguardando conexão</span>
                    </>
                  )}
                </div>
                {connectionStatus.connected && connectionStatus.phone && (
                  <p className="text-sm text-green-700 mt-1">
                    Telefone: {connectionStatus.phone}
                  </p>
                )}
                {lastChecked && (
                  <p className="text-xs text-gray-600 mt-1">
                    Último check: {lastChecked.toLocaleTimeString('pt-BR')}
                  </p>
                )}
              </div>
            )}

            {/* Instructions */}
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

            {/* Check Connection Button */}
            <div className="flex justify-center">
              <Button 
                onClick={checkConnection}
                disabled={isChecking}
                variant="outline"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Verificar Conexão
                  </>
                )}
              </Button>
            </div>
            
            {/* Navigation */}
            <div className="pt-4 border-t flex justify-between">
              <Button variant="outline" disabled>
                Anterior
              </Button>
              <Button disabled={!canProceed}>
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