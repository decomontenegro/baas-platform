'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string | null
  status: 'active' | 'revoked'
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    try {
      // Load from Clawdbot config
      const res = await fetch('/api/clawdbot/config')
      const data = await res.json()
      
      if (data.success) {
        // Extract API keys info from providers
        const providers = data.data?.models?.providers || []
        const extractedKeys: ApiKey[] = providers.map((p: { name: string; hasApiKey: boolean }, i: number) => ({
          id: `key-${i}`,
          name: `${p.name} API Key`,
          key: p.hasApiKey ? '••••••••••••••••' : 'Not configured',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          status: p.hasApiKey ? 'active' : 'revoked'
        }))
        setKeys(extractedKeys)
      }
    } catch (error) {
      console.error('Failed to load keys:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleShowKey(id: string) {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
  }

  async function createKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    
    // Simulate key creation
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      key: `baas_${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      status: 'active'
    }
    
    setKeys(prev => [...prev, newKey])
    setNewKeyName('')
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8" />
            API Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas chaves de API para integrações
          </p>
        </div>
      </div>

      {/* Create New Key */}
      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Chave</CardTitle>
          <CardDescription>
            Crie uma nova chave de API para suas integrações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="keyName">Nome da Chave</Label>
              <Input
                id="keyName"
                placeholder="Ex: Integração CRM"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar Chave
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Chaves Existentes</CardTitle>
          <CardDescription>
            {keys.length} chave(s) configurada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma chave de API configurada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((apiKey) => (
                <div 
                  key={apiKey.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      apiKey.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {apiKey.status === 'active' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{apiKey.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <code className="bg-muted px-2 py-0.5 rounded">
                          {showKey[apiKey.id] ? apiKey.key : '••••••••••••••••'}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleShowKey(apiKey.id)}
                        >
                          {showKey[apiKey.id] ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={apiKey.status === 'active' ? 'default' : 'destructive'}>
                      {apiKey.status === 'active' ? 'Ativa' : 'Revogada'}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => copyKey(apiKey.key)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LLM Provider Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Chaves de Providers LLM</CardTitle>
          <CardDescription>
            Configure suas chaves de API para os providers de IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">OpenAI</p>
                <p className="text-sm text-muted-foreground">GPT-4, GPT-3.5</p>
              </div>
              <Badge variant="outline">Não configurado</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Anthropic</p>
                <p className="text-sm text-muted-foreground">Claude 3</p>
              </div>
              <Badge variant="outline">Não configurado</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Groq</p>
                <p className="text-sm text-muted-foreground">Llama, Mixtral</p>
              </div>
              <Badge>Configurado</Badge>
            </div>
          </div>
          <Button variant="outline" className="w-full">
            Gerenciar Providers →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
