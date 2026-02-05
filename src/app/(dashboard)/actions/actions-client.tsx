'use client'

import { useState } from 'react'
import {
  Zap,
  Plus,
  Search,
  Settings2,
  Play,
  Trash2,
  Terminal,
  Hash,
  Regex,
  Clock,
  BarChart3,
  RefreshCw,
  MessageSquare,
  Globe,
  Mic,
  VolumeX,
  Info,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Action types with icons
const actionTypeIcons: Record<string, React.ReactNode> = {
  SUMMARIZE: <MessageSquare className="h-4 w-4" />,
  SEARCH: <Search className="h-4 w-4" />,
  REMIND: <Clock className="h-4 w-4" />,
  TRANSLATE: <Globe className="h-4 w-4" />,
  TRANSCRIBE: <Mic className="h-4 w-4" />,
  MUTE: <VolumeX className="h-4 w-4" />,
  STATUS: <Info className="h-4 w-4" />,
  HELP: <HelpCircle className="h-4 w-4" />,
  CUSTOM: <Sparkles className="h-4 w-4" />,
}

const actionTypeLabels: Record<string, string> = {
  SUMMARIZE: 'Resumir',
  SEARCH: 'Buscar',
  REMIND: 'Lembrar',
  TRANSLATE: 'Traduzir',
  TRANSCRIBE: 'Transcrever',
  MUTE: 'Silenciar',
  STATUS: 'Status',
  HELP: 'Ajuda',
  CUSTOM: 'Personalizado',
}

const triggerTypeIcons: Record<string, React.ReactNode> = {
  COMMAND: <Terminal className="h-3 w-3" />,
  KEYWORD: <Hash className="h-3 w-3" />,
  REGEX: <Regex className="h-3 w-3" />,
}

interface QuickAction {
  id: string
  name: string
  description: string | null
  trigger: string
  type: string
  config: Record<string, unknown>
  triggerType: string
  triggerConfig: Record<string, unknown>
  isEnabled: boolean
  isBuiltin: boolean
  executionCount: number
  lastExecutedAt: string | null
  createdAt: string
}

interface ActionExecution {
  id: string
  actionId: string
  channelId: string
  status: string
  durationMs: number | null
  executedAt: string
  error: string | null
  action: {
    id: string
    name: string
    trigger: string
    type: string
  }
}

// Mock data for development
const mockActions: QuickAction[] = [
  {
    id: '1',
    name: 'Resumir Mensagens',
    description: 'Resume as últimas mensagens da conversa',
    trigger: '/resumo',
    type: 'SUMMARIZE',
    config: { messageCount: 20, maxLength: 500 },
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/resume', '/sum'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 156,
    lastExecutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Buscar',
    description: 'Busca informações na base de conhecimento',
    trigger: '/buscar',
    type: 'SEARCH',
    config: { maxResults: 5 },
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/search', '/find'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 89,
    lastExecutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Lembrar',
    description: 'Cria um lembrete para o futuro',
    trigger: '/lembrar',
    type: 'REMIND',
    config: { maxDaysAhead: 365 },
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/remind', '/reminder'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 45,
    lastExecutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Traduzir',
    description: 'Traduz mensagens para outro idioma',
    trigger: '/traduzir',
    type: 'TRANSLATE',
    config: { supportedLanguages: ['en', 'es', 'fr', 'de'] },
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/translate', '/trad'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 23,
    lastExecutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Silenciar',
    description: 'Silencia o bot temporariamente neste canal',
    trigger: '/silenciar',
    type: 'MUTE',
    config: { maxDurationSeconds: 3600 },
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/mute', '/quiet'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 12,
    lastExecutedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Status',
    description: 'Mostra o status do bot neste canal',
    trigger: '/status',
    type: 'STATUS',
    config: { showUptime: true, showStats: true },
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/info'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 34,
    lastExecutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '7',
    name: 'Ajuda',
    description: 'Lista os comandos disponíveis',
    trigger: '/ajuda',
    type: 'HELP',
    config: {},
    triggerType: 'COMMAND',
    triggerConfig: { aliases: ['/help', '/comandos', '/?'] },
    isEnabled: true,
    isBuiltin: true,
    executionCount: 78,
    lastExecutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
]

const mockExecutions: ActionExecution[] = [
  {
    id: '1',
    actionId: '1',
    channelId: 'whatsapp-123',
    status: 'COMPLETED',
    durationMs: 245,
    executedAt: new Date().toISOString(),
    error: null,
    action: { id: '1', name: 'Resumir Mensagens', trigger: '/resumo', type: 'SUMMARIZE' },
  },
  {
    id: '2',
    actionId: '2',
    channelId: 'telegram-456',
    status: 'COMPLETED',
    durationMs: 189,
    executedAt: new Date(Date.now() - 300000).toISOString(),
    error: null,
    action: { id: '2', name: 'Buscar', trigger: '/buscar', type: 'SEARCH' },
  },
  {
    id: '3',
    actionId: '7',
    channelId: 'whatsapp-123',
    status: 'COMPLETED',
    durationMs: 56,
    executedAt: new Date(Date.now() - 600000).toISOString(),
    error: null,
    action: { id: '7', name: 'Ajuda', trigger: '/ajuda', type: 'HELP' },
  },
]

export default function ActionsClient() {
  const [actions, setActions] = useState<QuickAction[]>(mockActions)
  const [executions, setExecutions] = useState<ActionExecution[]>(mockExecutions)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)

  // Filter actions
  const filteredActions = (actions ?? []).filter(action => {
    const matchesSearch = 
      action.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = filterType === 'all' || action.type === filterType
    
    return matchesSearch && matchesType
  })

  // Toggle action enabled state
  const toggleAction = async (actionId: string) => {
    setActions(prev => 
      (prev ?? []).map(a => 
        a.id === actionId ? { ...a, isEnabled: !a.isEnabled } : a
      )
    )
  }

  // Test action
  const handleTestAction = async () => {
    if (!selectedAction || !testMessage) return
    
    // Simulate testing
    setTestResult('⏳ Executando...')
    
    setTimeout(() => {
      setTestResult(`✅ Ação "${selectedAction.name}" executada com sucesso!\n\nResultado simulado: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`)
    }, 1000)
  }

  // Calculate stats
  const totalExecutions = (actions ?? []).reduce((sum, a) => sum + a.executionCount, 0)
  const activeActions = (actions ?? []).filter(a => a.isEnabled).length
  const customActions = (actions ?? []).filter(a => !a.isBuiltin).length

  const actionTypeLabelEntries = Object.entries(actionTypeLabels)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ações Rápidas</h1>
          <p className="text-muted-foreground">
            Comandos e ações que usuários podem executar via chat
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Ação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Ação</DialogTitle>
              <DialogDescription>
                Configure uma nova ação que os usuários podem executar
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" placeholder="Nome da ação" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trigger">Comando</Label>
                <Input id="trigger" placeholder="/comando" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypeLabelEntries.map(([type, label]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {actionTypeIcons[type]}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" placeholder="Descreva o que esta ação faz" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="triggerType">Tipo de Trigger</Label>
                <Select defaultValue="COMMAND">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMMAND">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        Comando (começa com /)
                      </div>
                    </SelectItem>
                    <SelectItem value="KEYWORD">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Palavra-chave
                      </div>
                    </SelectItem>
                    <SelectItem value="REGEX">
                      <div className="flex items-center gap-2">
                        <Regex className="h-4 w-4" />
                        Expressão Regular
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(false)}>
                Criar Ação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Ações
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(actions ?? []).length}</div>
            <p className="text-xs text-muted-foreground">
              {customActions} personalizadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ações Ativas
            </CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeActions}</div>
            <p className="text-xs text-muted-foreground">
              de {(actions ?? []).length} ações
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Execuções (Hoje)
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExecutions}</div>
            <p className="text-xs text-muted-foreground">
              +12% vs ontem
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">163ms</div>
            <p className="text-xs text-muted-foreground">
              tempo de resposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="actions">
            <Zap className="mr-2 h-4 w-4" />
            Ações
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="mr-2 h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {actionTypeLabelEntries.map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {actionTypeIcons[type]}
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions List */}
          <div className="grid gap-4">
            {filteredActions.map((action) => (
              <Card key={action.id} className="overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      action.isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {actionTypeIcons[action.type]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{action.name}</h3>
                        {action.isBuiltin && (
                          <Badge variant="secondary" className="text-xs">
                            Built-in
                          </Badge>
                        )}
                        {!action.isEnabled && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Desativado
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {action.trigger}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {triggerTypeIcons[action.triggerType]}
                        <span>{action.triggerType}</span>
                      </div>
                    </div>
                    <div className="hidden lg:block text-right">
                      <div className="text-sm font-medium">{action.executionCount}</div>
                      <div className="text-xs text-muted-foreground">execuções</div>
                    </div>
                    <Switch
                      checked={action.isEnabled}
                      onCheckedChange={() => toggleAction(action.id)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedAction(action)
                          setTestMessage(action.trigger)
                          setTestResult(null)
                          setIsTestDialogOpen(true)
                        }}>
                          <Play className="mr-2 h-4 w-4" />
                          Testar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings2 className="mr-2 h-4 w-4" />
                          Configurar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!action.isBuiltin && (
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {/* Aliases */}
                {((action.triggerConfig as any)?.aliases ?? []).length > 0 && (
                  <div className="border-t px-4 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Aliases:</span>
                      {((action.triggerConfig as any)?.aliases ?? []).map((alias: string) => (
                        <Badge key={alias} variant="secondary" className="font-mono text-xs">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Execuções</CardTitle>
                  <CardDescription>
                    Últimas ações executadas pelos usuários
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(executions ?? []).map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {actionTypeIcons[execution.action.type]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{execution.action.name}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {execution.action.trigger}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Canal: {execution.channelId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={execution.status === 'COMPLETED' ? 'default' : 'destructive'}>
                        {execution.status === 'COMPLETED' ? '✓ Sucesso' : '✕ Erro'}
                      </Badge>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {execution.durationMs}ms
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(execution.executedAt).toLocaleTimeString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Testar Ação: {selectedAction?.name}</DialogTitle>
            <DialogDescription>
              Simule a execução desta ação para verificar se está funcionando corretamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="testMessage">Mensagem de teste</Label>
              <Input
                id="testMessage"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder={selectedAction?.trigger || '/comando'}
              />
            </div>
            {testResult && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleTestAction}>
              <Play className="mr-2 h-4 w-4" />
              Executar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
