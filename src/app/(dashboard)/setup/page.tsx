'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  MessageSquare, 
  Bot, 
  Zap,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Key,
  Sparkles
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5

interface SetupData {
  whatsapp: {
    connected: boolean
    phone?: string
  }
  llm: {
    provider: string
    apiKey: string
    configured: boolean
  }
  agent: {
    name: string
    vibe: string
    emoji: string
    soul: string
  }
}

const STEPS = [
  { id: 1, title: 'WhatsApp', icon: Smartphone, description: 'Conectar WhatsApp' },
  { id: 2, title: 'LLM', icon: Key, description: 'Configurar IA' },
  { id: 3, title: 'Agente', icon: Bot, description: 'Definir persona' },
  { id: 4, title: 'Testar', icon: MessageSquare, description: 'Validar bot' },
  { id: 5, title: 'Deploy', icon: Zap, description: 'Ativar' },
]

export default function SetupWizardPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [setupData, setSetupData] = useState<SetupData>({
    whatsapp: { connected: false },
    llm: { provider: '', apiKey: '', configured: false },
    agent: { name: '', vibe: '', emoji: '🤖', soul: '' }
  })

  // Check initial status
  useEffect(() => {
    checkWhatsAppStatus()
    loadCurrentConfig()
    loadAgentConfig()
  }, [])

  async function checkWhatsAppStatus() {
    try {
      const res = await fetch('/api/clawdbot/whatsapp/link')
      const data = await res.json()
      if (data.success) {
        setSetupData(prev => ({
          ...prev,
          whatsapp: {
            connected: data.data.connected,
            phone: data.data.phone
          }
        }))
      }
    } catch (e) {
      console.error('WhatsApp status check failed:', e)
    }
  }

  async function loadCurrentConfig() {
    try {
      const res = await fetch('/api/clawdbot/config')
      const data = await res.json()
      if (data.success && data.data.models?.providers?.length > 0) {
        const provider = data.data.models.providers[0]
        setSetupData(prev => ({
          ...prev,
          llm: {
            provider: provider.name,
            apiKey: provider.hasApiKey ? '••••••••' : '',
            configured: provider.hasApiKey
          }
        }))
      }
    } catch (e) {
      console.error('Config load failed:', e)
    }
  }

  async function loadAgentConfig() {
    try {
      const res = await fetch('/api/clawdbot/agent/soul')
      const data = await res.json()
      if (data.success) {
        setSetupData(prev => ({
          ...prev,
          agent: {
            name: data.data.parsed.name || '',
            vibe: data.data.parsed.vibe || '',
            emoji: data.data.parsed.emoji || '🤖',
            soul: data.data.soul || ''
          }
        }))
      }
    } catch (e) {
      console.error('Agent config load failed:', e)
    }
  }

  async function saveLLMConfig() {
    setLoading(true)
    try {
      const res = await fetch('/api/clawdbot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'llm',
          data: {
            provider: setupData.llm.provider,
            apiKey: setupData.llm.apiKey
          }
        })
      })
      const data = await res.json()
      if (data.success) {
        setSetupData(prev => ({
          ...prev,
          llm: { ...prev.llm, configured: true }
        }))
      }
    } catch (e) {
      console.error('LLM config save failed:', e)
    } finally {
      setLoading(false)
    }
  }

  async function saveAgentConfig() {
    setLoading(true)
    try {
      const res = await fetch('/api/clawdbot/agent/soul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: setupData.agent.name,
          vibe: setupData.agent.vibe,
          emoji: setupData.agent.emoji,
          soul: setupData.agent.soul
        })
      })
      await res.json()
    } catch (e) {
      console.error('Agent config save failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" />
          Setup Wizard
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure seu bot em 5 passos simples
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <Progress value={progress} className="h-2 mb-4" />
        <div className="flex justify-between">
          {STEPS.map((step) => (
            <div 
              key={step.id}
              className={`flex flex-col items-center ${
                currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                currentStep > step.id 
                  ? 'bg-primary border-primary text-primary-foreground'
                  : currentStep === step.id
                  ? 'border-primary'
                  : 'border-muted'
              }`}>
                {currentStep > step.id ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {STEPS[currentStep - 1].icon && (
              <span>{<STEPS[currentStep - 1].icon className="w-5 h-5" />}</span>
            )}
            {STEPS[currentStep - 1].title}
          </CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Step 1: WhatsApp */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {setupData.whatsapp.connected ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">WhatsApp Conectado!</span>
                  </div>
                  {setupData.whatsapp.phone && (
                    <p className="text-sm text-green-600 mt-1">{setupData.whatsapp.phone}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Para conectar seu WhatsApp, use o comando no terminal:
                  </p>
                  <code className="block p-3 bg-muted rounded-lg text-sm">
                    clawdbot whatsapp link
                  </code>
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR code com seu WhatsApp para vincular.
                  </p>
                  <Button onClick={checkWhatsAppStatus} variant="outline">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificar Conexão
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: LLM */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {setupData.llm.configured ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">LLM Configurado: {setupData.llm.provider}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Input
                      id="provider"
                      placeholder="openai, anthropic, groq..."
                      value={setupData.llm.provider}
                      onChange={(e) => setSetupData(prev => ({
                        ...prev,
                        llm: { ...prev.llm, provider: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="sk-..."
                      value={setupData.llm.apiKey}
                      onChange={(e) => setSetupData(prev => ({
                        ...prev,
                        llm: { ...prev.llm, apiKey: e.target.value }
                      }))}
                    />
                  </div>
                  <Button onClick={saveLLMConfig} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar Configuração
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 3: Agent */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do Bot</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Lobo, Aria, Max..."
                    value={setupData.agent.name}
                    onChange={(e) => setSetupData(prev => ({
                      ...prev,
                      agent: { ...prev.agent, name: e.target.value }
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="emoji">Emoji</Label>
                  <Input
                    id="emoji"
                    placeholder="🤖"
                    value={setupData.agent.emoji}
                    onChange={(e) => setSetupData(prev => ({
                      ...prev,
                      agent: { ...prev.agent, emoji: e.target.value }
                    }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vibe">Personalidade</Label>
                <Input
                  id="vibe"
                  placeholder="Ex: Casual, direto, prestativo"
                  value={setupData.agent.vibe}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    agent: { ...prev.agent, vibe: e.target.value }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="soul">SOUL.md (Instruções detalhadas)</Label>
                <Textarea
                  id="soul"
                  rows={6}
                  placeholder="Descreva como o bot deve se comportar..."
                  value={setupData.agent.soul}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    agent: { ...prev.agent, soul: e.target.value }
                  }))}
                />
              </div>
              <Button onClick={saveAgentConfig} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar Persona
              </Button>
            </div>
          )}

          {/* Step 4: Test */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Envie uma mensagem de teste para validar o comportamento do bot.
              </p>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-center text-muted-foreground">
                  Chat de teste em desenvolvimento...
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Deploy */}
          {currentStep === 5 && (
            <div className="space-y-4 text-center">
              <div className="p-8">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold">Configuração Completa!</h3>
                <p className="text-muted-foreground mt-2">
                  Seu bot está pronto para usar.
                </p>
              </div>
              <Button size="lg" className="w-full">
                <Zap className="w-5 h-5 mr-2" />
                Ativar Bot em Produção
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => (prev > 1 ? prev - 1 : prev) as Step)}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          onClick={() => setCurrentStep(prev => (prev < 5 ? prev + 1 : prev) as Step)}
          disabled={currentStep === 5}
        >
          Próximo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
