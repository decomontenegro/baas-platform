"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import useSWR from "swr"
import {
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Mail,
  MessageSquare,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Target,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Campaign {
  id: string
  name: string
  description: string | null
  type: CampaignType
  status: CampaignStatus
  scheduledFor: string | null
  startedAt: string | null
  completedAt: string | null
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  respondedCount: number
  failedCount: number
  createdAt: string
  _count?: {
    recipients: number
  }
}

type CampaignType = "BROADCAST" | "NEWSLETTER" | "FOLLOW_UP" | "RE_ENGAGEMENT" | "SATISFACTION" | "PROMOTIONAL" | "REMINDER" | "CUSTOM"
type CampaignStatus = "DRAFT" | "SCHEDULED" | "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED"

interface CampaignStats {
  campaign: {
    id: string
    name: string
    type: CampaignType
    status: CampaignStatus
    startedAt: string | null
    completedAt: string | null
  }
  recipients: {
    total: number
    pending: number
    sent: number
    delivered: number
    read: number
    responded: number
    failed: number
  }
  rates: {
    deliveryRate: string
    readRate: string
    responseRate: string
    failureRate: string
  }
  progress: {
    processed: number
    remaining: number
    percentage: string
  }
}

const statusColors: Record<CampaignStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  DRAFT: "secondary",
  SCHEDULED: "default",
  QUEUED: "warning",
  RUNNING: "warning",
  PAUSED: "secondary",
  COMPLETED: "success",
  CANCELLED: "secondary",
  FAILED: "destructive",
}

const statusLabels: Record<CampaignStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  QUEUED: "Na Fila",
  RUNNING: "Enviando",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
}

const typeLabels: Record<CampaignType, string> = {
  BROADCAST: "Broadcast",
  NEWSLETTER: "Newsletter",
  FOLLOW_UP: "Follow-up",
  RE_ENGAGEMENT: "Reengajamento",
  SATISFACTION: "Satisfação",
  PROMOTIONAL: "Promocional",
  REMINDER: "Lembrete",
  CUSTOM: "Personalizada",
}

const typeIcons: Record<CampaignType, React.ReactNode> = {
  BROADCAST: <Send className="h-4 w-4" />,
  NEWSLETTER: <Mail className="h-4 w-4" />,
  FOLLOW_UP: <RefreshCw className="h-4 w-4" />,
  RE_ENGAGEMENT: <Target className="h-4 w-4" />,
  SATISFACTION: <BarChart3 className="h-4 w-4" />,
  PROMOTIONAL: <TrendingUp className="h-4 w-4" />,
  REMINDER: <Clock className="h-4 w-4" />,
  CUSTOM: <Filter className="h-4 w-4" />,
}

export default function CampaignsClient() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<CampaignStatus | "ALL">("ALL")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [selectedCampaign, setSelectedCampaign] = React.useState<Campaign | null>(null)
  const [isStatsOpen, setIsStatsOpen] = React.useState(false)

  // Fetch campaigns
  const { data, error, isLoading, mutate } = useSWR<{ campaigns: Campaign[] }>(
    "/api/campaigns?limit=50",
    fetcher
  )

  const campaigns = data?.campaigns ?? []

  // Filter campaigns
  const filteredCampaigns = React.useMemo(() => {
    let result = campaigns

    if (statusFilter !== "ALL") {
      result = result.filter((c) => c.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      )
    }

    return result
  }, [campaigns, statusFilter, searchQuery])

  // Stats
  const stats = React.useMemo(() => {
    return {
      total: campaigns.length,
      draft: campaigns.filter((c) => c.status === "DRAFT").length,
      active: campaigns.filter((c) => ["RUNNING", "QUEUED"].includes(c.status)).length,
      completed: campaigns.filter((c) => c.status === "COMPLETED").length,
    }
  }, [campaigns])

  const handleStartCampaign = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}/start`, { method: "POST" })
      mutate()
    } catch (error) {
      console.error("Failed to start campaign:", error)
    }
  }

  const handlePauseCampaign = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}/pause`, { method: "POST" })
      mutate()
    } catch (error) {
      console.error("Failed to pause campaign:", error)
    }
  }

  const handleDeleteCampaign = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" })
      mutate()
    } catch (error) {
      console.error("Failed to delete campaign:", error)
    }
  }

  const handleViewStats = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setIsStatsOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground">
            Crie e gerencie campanhas de mensagens em massa
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">campanhas criadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rascunhos</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">aguardando envio</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">em andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">finalizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as CampaignStatus | "ALL")}
        >
          <TabsList>
            <TabsTrigger value="ALL">Todas</TabsTrigger>
            <TabsTrigger value="DRAFT">Rascunhos</TabsTrigger>
            <TabsTrigger value="RUNNING">Ativas</TabsTrigger>
            <TabsTrigger value="COMPLETED">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "ALL"
                  ? "Nenhuma campanha encontrada"
                  : "Você ainda não criou nenhuma campanha"}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar campanha
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        campaign.status === "RUNNING" && "bg-yellow-100 text-yellow-600",
                        campaign.status === "COMPLETED" && "bg-green-100 text-green-600",
                        campaign.status === "FAILED" && "bg-red-100 text-red-600",
                        !["RUNNING", "COMPLETED", "FAILED"].includes(campaign.status) &&
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {typeIcons[campaign.type]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{campaign.name}</span>
                        <Badge variant={statusColors[campaign.status]}>
                          {statusLabels[campaign.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{typeLabels[campaign.type]}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {campaign._count?.recipients ?? campaign.totalRecipients} destinatários
                        </span>
                        {campaign.scheduledFor && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(campaign.scheduledFor), "dd/MM/yyyy HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar for running campaigns */}
                  {campaign.status === "RUNNING" && campaign.totalRecipients > 0 && (
                    <div className="hidden md:flex items-center gap-4 flex-1 max-w-xs mx-8">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${(campaign.sentCount / campaign.totalRecipients) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {Math.round((campaign.sentCount / campaign.totalRecipients) * 100)}%
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewStats(campaign)}
                    >
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Stats
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewStats(campaign)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                        {campaign.status === "DRAFT" && (
                          <DropdownMenuItem onClick={() => handleStartCampaign(campaign.id)}>
                            <Play className="mr-2 h-4 w-4" />
                            Iniciar
                          </DropdownMenuItem>
                        )}
                        {campaign.status === "RUNNING" && (
                          <DropdownMenuItem onClick={() => handlePauseCampaign(campaign.id)}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pausar
                          </DropdownMenuItem>
                        )}
                        {campaign.status === "PAUSED" && (
                          <DropdownMenuItem onClick={() => handleStartCampaign(campaign.id)}>
                            <Play className="mr-2 h-4 w-4" />
                            Retomar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          setIsCreateOpen(false)
          mutate()
        }}
      />

      {/* Stats Dialog */}
      <CampaignStatsDialog
        campaign={selectedCampaign}
        open={isStatsOpen}
        onOpenChange={setIsStatsOpen}
      />
    </div>
  )
}

// Create Campaign Dialog
function CreateCampaignDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    type: "BROADCAST" as CampaignType,
    content: "",
    audienceType: "ALL" as "ALL" | "SEGMENT" | "SPECIFIC" | "IMPORT",
    scheduledFor: "",
  })

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          scheduledFor: formData.scheduledFor
            ? new Date(formData.scheduledFor).toISOString()
            : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create campaign")
      }

      onSuccess()
      setStep(1)
      setFormData({
        name: "",
        description: "",
        type: "BROADCAST",
        content: "",
        audienceType: "ALL",
        scheduledFor: "",
      })
    } catch (error) {
      console.error("Failed to create campaign:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const typeEntries = Object.entries(typeLabels) as [CampaignType, string][]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
          <DialogDescription>
            {step === 1 && "Configure os detalhes básicos da campanha"}
            {step === 2 && "Escreva o conteúdo da mensagem"}
            {step === 3 && "Revise e confirme a campanha"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-2 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Campanha</label>
              <Input
                placeholder="Ex: Black Friday 2024"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Descreva o objetivo da campanha..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Campanha</label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as CampaignType })}
              >
                {typeEntries.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Audiência</label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={formData.audienceType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    audienceType: e.target.value as "ALL" | "SEGMENT" | "SPECIFIC" | "IMPORT",
                  })
                }
              >
                <option value="ALL">Todos os contatos</option>
                <option value="SEGMENT">Segmento específico</option>
                <option value="SPECIFIC">Contatos selecionados</option>
                <option value="IMPORT">Importar lista</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem</label>
              <textarea
                className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Digite sua mensagem aqui...

Use {{nome}} para personalizar com o nome do contato."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Agendar para (opcional)</label>
              <Input
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para salvar como rascunho
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Nome</span>
                <span className="font-medium">{formData.name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tipo</span>
                <span className="font-medium">{typeLabels[formData.type]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Audiência</span>
                <span className="font-medium">
                  {formData.audienceType === "ALL" && "Todos os contatos"}
                  {formData.audienceType === "SEGMENT" && "Segmento específico"}
                  {formData.audienceType === "SPECIFIC" && "Contatos selecionados"}
                  {formData.audienceType === "IMPORT" && "Lista importada"}
                </span>
              </div>
              {formData.scheduledFor && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Agendado para</span>
                  <span className="font-medium">
                    {format(new Date(formData.scheduledFor), "dd/MM/yyyy 'às' HH:mm")}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Prévia da mensagem</span>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm whitespace-pre-wrap">{formData.content || "(Sem conteúdo)"}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={handleBack}>
              Voltar
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && !formData.name}
            >
              Próximo
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Campanha"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Campaign Stats Dialog
function CampaignStatsDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useSWR<{ stats: CampaignStats }>(
    campaign && open ? `/api/campaigns/${campaign.id}/stats` : null,
    fetcher
  )

  const stats = data?.stats

  if (!campaign) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{campaign.name}</DialogTitle>
          <DialogDescription>
            Estatísticas e métricas da campanha
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Progress */}
            {(stats.progress?.remaining ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{stats.progress?.percentage ?? '0'}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${stats.progress?.percentage ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.progress?.processed ?? 0} de {stats.recipients?.total ?? 0} processados
                </p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">{stats.recipients?.sent ?? 0}</div>
                <div className="text-xs text-muted-foreground">Enviados</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{stats.recipients?.delivered ?? 0}</div>
                <div className="text-xs text-muted-foreground">Entregues</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-purple-600">{stats.recipients?.read ?? 0}</div>
                <div className="text-xs text-muted-foreground">Lidos</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-orange-600">{stats.recipients?.responded ?? 0}</div>
                <div className="text-xs text-muted-foreground">Respondidos</div>
              </div>
            </div>

            {/* Rates */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Taxas</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-sm text-muted-foreground">Entrega</span>
                  <span className="font-medium">{stats.rates?.deliveryRate ?? '0'}%</span>
                </div>
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-sm text-muted-foreground">Leitura</span>
                  <span className="font-medium">{stats.rates?.readRate ?? '0'}%</span>
                </div>
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-sm text-muted-foreground">Resposta</span>
                  <span className="font-medium">{stats.rates?.responseRate ?? '0'}%</span>
                </div>
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-sm text-muted-foreground">Falha</span>
                  <span className="font-medium text-destructive">{stats.rates?.failureRate ?? '0'}%</span>
                </div>
              </div>
            </div>

            {/* Failed count warning */}
            {(stats.recipients?.failed ?? 0) > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">
                  {stats.recipients?.failed ?? 0} mensagens falharam
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Não foi possível carregar as estatísticas
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
