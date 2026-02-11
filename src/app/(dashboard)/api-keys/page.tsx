"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, Copy, Plus, Trash2, Key } from "lucide-react"

interface APIKey {
  id: string
  name: string
  key: string
  provider: string
  status: 'active' | 'inactive'
  createdAt: string
  lastUsed?: string
}

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = React.useState<APIKey[]>([
    {
      id: '1',
      name: 'Groq Production',
      key: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      provider: 'Groq',
      status: 'active',
      createdAt: '2026-02-01',
      lastUsed: '2026-02-10'
    },
    {
      id: '2', 
      name: 'Anthropic OAuth Primary',
      key: 'oauth_credential_configured',
      provider: 'Anthropic',
      status: 'active',
      createdAt: '2026-01-15',
      lastUsed: '2026-02-10'
    }
  ])

  const [showKey, setShowKey] = React.useState<Record<string, boolean>>({})
  const [isCreating, setIsCreating] = React.useState(false)

  const toggleKeyVisibility = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const maskKey = (key: string) => {
    if (key === 'oauth_credential_configured') return key
    return key.substring(0, 8) + '*'.repeat(20) + key.substring(key.length - 4)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Gerencie as chaves de API dos provedores LLM
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Chave API
        </Button>
      </div>

      {/* Current API Keys */}
      <div className="space-y-4">
        {apiKeys.map((apiKey) => (
          <Card key={apiKey.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center space-x-3">
                <Key className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{apiKey.provider}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                  {apiKey.status === 'active' ? 'Ativa' : 'Inativa'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleKeyVisibility(apiKey.id)}
                >
                  {showKey[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(apiKey.key)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded border">
                    {showKey[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Criada: {apiKey.createdAt}</span>
                  {apiKey.lastUsed && <span>Último uso: {apiKey.lastUsed}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Key Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Nova Chave API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="keyName">Nome da Chave</Label>
              <Input id="keyName" placeholder="Ex: OpenAI Production" />
            </div>
            <div>
              <Label htmlFor="provider">Provider</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione um provider</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="groq">Groq</option>
                <option value="google">Google AI</option>
              </select>
            </div>
            <div>
              <Label htmlFor="apiKey">Chave API</Label>
              <Input id="apiKey" type="password" placeholder="Insira a chave API" />
            </div>
            <div className="flex space-x-2">
              <Button>Adicionar Chave</Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Uso das Chaves API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Groq</span>
                <span className="font-medium">Ativo</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
              <p className="text-xs text-muted-foreground">65% do limite diário usado</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Anthropic OAuth</span>
                <span className="font-medium">Ativo</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '20%' }}></div>
              </div>
              <p className="text-xs text-muted-foreground">20% do limite diário usado</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}