"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, isSameMonth, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import useSWR from "swr"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pause,
  Play,
  Filter,
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface ScheduledMessage {
  id: string
  name: string | null
  content: string
  scheduledFor: string
  scheduleType: "ONE_TIME" | "RECURRING" | "TRIGGER_BASED"
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED" | "PAUSED" | "COMPLETED"
  channelId: string
  contactId: string | null
  tags: string[]
  createdAt: string
}

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "default",
  PROCESSING: "warning",
  SENT: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
  PAUSED: "warning",
  COMPLETED: "success",
}

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Enviando",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
}

const typeLabels: Record<string, string> = {
  ONE_TIME: "Único",
  RECURRING: "Recorrente",
  TRIGGER_BASED: "Por Gatilho",
}

const typeIcons: Record<string, React.ReactNode> = {
  ONE_TIME: <Clock className="h-3 w-3" />,
  RECURRING: <RefreshCw className="h-3 w-3" />,
  TRIGGER_BASED: <Filter className="h-3 w-3" />,
}

export default function ScheduledMessagesPage() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  // Fetch scheduled messages
  const startDate = startOfMonth(currentMonth).toISOString()
  const endDate = endOfMonth(currentMonth).toISOString()
  
  const { data, error, isLoading, mutate } = useSWR<{ messages: ScheduledMessage[] }>(
    `/api/scheduled?dateFrom=${startDate}&dateTo=${endDate}&limit=100`,
    fetcher
  )

  const messages = data?.messages || []

  // Group messages by date
  const messagesByDate = React.useMemo(() => {
    const grouped: Record<string, ScheduledMessage[]> = {}
    messages.forEach((msg) => {
      const dateKey = format(parseISO(msg.scheduledFor), "yyyy-MM-dd")
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(msg)
    })
    return grouped
  }, [messages])

  // Get messages for selected date
  const selectedDateMessages = React.useMemo(() => {
    if (!selectedDate) return []
    const dateKey = format(selectedDate, "yyyy-MM-dd")
    return messagesByDate[dateKey] || []
  }, [selectedDate, messagesByDate])

  // Filter messages by search
  const filteredMessages = React.useMemo(() => {
    if (!searchQuery) return selectedDateMessages
    const query = searchQuery.toLowerCase()
    return selectedDateMessages.filter(
      (msg) =>
        msg.name?.toLowerCase().includes(query) ||
        msg.content.toLowerCase().includes(query) ||
        msg.contactId?.toLowerCase().includes(query)
    )
  }, [selectedDateMessages, searchQuery])

  // Calendar days
  const days = React.useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const handleDeleteMessage = async (id: string) => {
    try {
      await fetch(`/api/scheduled/${id}`, { method: "DELETE" })
      mutate()
    } catch (error) {
      console.error("Failed to delete message:", error)
    }
  }

  const handlePauseMessage = async (id: string) => {
    try {
      await fetch(`/api/scheduled/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      })
      mutate()
    } catch (error) {
      console.error("Failed to pause message:", error)
    }
  }

  const handleResumeMessage = async (id: string) => {
    try {
      await fetch(`/api/scheduled/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING" }),
      })
      mutate()
    } catch (error) {
      console.error("Failed to resume message:", error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground">
            Gerencie mensagens agendadas e recorrentes
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Calendário</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-40 text-center font-medium">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month start */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => (
                <div key={`empty-start-${i}`} className="aspect-square" />
              ))}

              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const dayMessages = messagesByDate[dateKey] || []
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const hasMessages = dayMessages.length > 0

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square rounded-lg p-1 text-sm transition-colors relative",
                      "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                      isToday(day) && !isSelected && "bg-accent",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50"
                    )}
                  >
                    <span className="block">{format(day, "d")}</span>
                    {hasMessages && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayMessages.length <= 3 ? (
                          dayMessages.map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-1 h-1 rounded-full",
                                isSelected ? "bg-primary-foreground" : "bg-primary"
                              )}
                            />
                          ))
                        ) : (
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              isSelected ? "text-primary-foreground" : "text-primary"
                            )}
                          >
                            {dayMessages.length}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Este Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{messages.length}</div>
              <p className="text-xs text-muted-foreground">mensagens agendadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {messages.filter((m) => m.status === "PENDING").length}
              </div>
              <p className="text-xs text-muted-foreground">aguardando envio</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recorrentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {messages.filter((m) => m.scheduleType === "RECURRING").length}
              </div>
              <p className="text-xs text-muted-foreground">mensagens ativas</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected Date Messages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedDate
                  ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                  : "Selecione uma data"}
              </CardTitle>
              <CardDescription>
                {selectedDate
                  ? `${selectedDateMessages.length} mensagen${selectedDateMessages.length !== 1 ? "s" : ""} agendada${selectedDateMessages.length !== 1 ? "s" : ""}`
                  : "Clique em uma data no calendário para ver os agendamentos"}
              </CardDescription>
            </div>
            {selectedDate && selectedDateMessages.length > 0 && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar mensagens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Selecione uma data no calendário para ver os agendamentos
              </p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Nenhuma mensagem encontrada"
                  : "Nenhuma mensagem agendada para esta data"}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agendar mensagem
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {message.name || "Sem nome"}
                      </span>
                      <Badge variant="outline" className="gap-1">
                        {typeIcons[message.scheduleType]}
                        {typeLabels[message.scheduleType]}
                      </Badge>
                      <Badge variant={statusColors[message.status]}>
                        {statusLabels[message.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {message.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(message.scheduledFor), "HH:mm")}
                      </span>
                      {message.contactId && (
                        <span>Para: {message.contactId}</span>
                      )}
                      {message.tags.length > 0 && (
                        <div className="flex gap-1">
                          {message.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {message.status === "PENDING" && (
                        <DropdownMenuItem onClick={() => handlePauseMessage(message.id)}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar
                        </DropdownMenuItem>
                      )}
                      {message.status === "PAUSED" && (
                        <DropdownMenuItem onClick={() => handleResumeMessage(message.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Retomar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateScheduledMessageDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        selectedDate={selectedDate}
        onSuccess={() => {
          setIsCreateOpen(false)
          mutate()
        }}
      />
    </div>
  )
}

// Create Scheduled Message Dialog
function CreateScheduledMessageDialog({
  open,
  onOpenChange,
  selectedDate,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date | null
  onSuccess: () => void
}) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    content: "",
    scheduledFor: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : "",
    scheduleType: "ONE_TIME" as "ONE_TIME" | "RECURRING" | "TRIGGER_BASED",
    contactId: "",
  })

  React.useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        scheduledFor: format(selectedDate, "yyyy-MM-dd'T'09:00"),
      }))
    }
  }, [selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Note: In a real app, workspaceId and channelId would come from context/selection
      const response = await fetch("/api/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          workspaceId: "placeholder-workspace-id", // Would come from context
          channelId: "placeholder-channel-id", // Would come from selection
          scheduledFor: new Date(formData.scheduledFor).toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create scheduled message")
      }

      onSuccess()
      setFormData({
        name: "",
        content: "",
        scheduledFor: "",
        scheduleType: "ONE_TIME",
        contactId: "",
      })
    } catch (error) {
      console.error("Failed to create scheduled message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            Agende uma mensagem para ser enviada automaticamente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome (opcional)</label>
            <Input
              placeholder="Ex: Lembrete de reunião"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mensagem</label>
            <textarea
              className="w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Digite sua mensagem..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Contato (ID)</label>
            <Input
              placeholder="Ex: +5511999999999"
              value={formData.contactId}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data e Hora</label>
              <Input
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={formData.scheduleType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    scheduleType: e.target.value as "ONE_TIME" | "RECURRING" | "TRIGGER_BASED",
                  })
                }
              >
                <option value="ONE_TIME">Único</option>
                <option value="RECURRING">Recorrente</option>
                <option value="TRIGGER_BASED">Por Gatilho</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
