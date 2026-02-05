"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import {
  Brain,
  Plus,
  Search,
  FileText,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Database,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  embeddingModel: string
  chunkSize: number
  chunkOverlap: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  stats: {
    documentCount: number
    totalTokens: number
  }
}

interface ApiResponse {
  knowledgeBases: KnowledgeBase[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function KnowledgeBasePage() {
  const router = useRouter()
  const [knowledgeBases, setKnowledgeBases] = React.useState<KnowledgeBase[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebounce(search, 300)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  // New KB form state
  const [newName, setNewName] = React.useState("")
  const [newDescription, setNewDescription] = React.useState("")

  const fetchKnowledgeBases = React.useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)

      const response = await fetch(`/api/knowledge?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")

      const data: ApiResponse = await response.json()
      setKnowledgeBases(data.knowledgeBases)
    } catch (error) {
      console.error("Error fetching knowledge bases:", error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  React.useEffect(() => {
    fetchKnowledgeBases()
  }, [fetchKnowledgeBases])

  const handleCreate = async () => {
    if (!newName.trim()) return

    try {
      setCreating(true)
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
        }),
      })

      if (!response.ok) throw new Error("Failed to create")

      setNewName("")
      setNewDescription("")
      setCreateOpen(false)
      fetchKnowledgeBases()
    } catch (error) {
      console.error("Error creating knowledge base:", error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta knowledge base?")) return

    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      fetchKnowledgeBases()
    } catch (error) {
      console.error("Error deleting knowledge base:", error)
    }
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Gerencie bases de conhecimento para seus bots
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Knowledge Base
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Knowledge Base</DialogTitle>
              <DialogDescription>
                Crie uma nova base de conhecimento para armazenar documentos e
                informações que seus bots podem usar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Ex: FAQ da Empresa"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o propósito desta knowledge base..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar knowledge bases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchKnowledgeBases}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Knowledge Base Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : knowledgeBases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhuma knowledge base</h3>
            <p className="text-muted-foreground text-center mt-1">
              Crie sua primeira knowledge base para começar a adicionar documentos.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Knowledge Base
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <Card
              key={kb.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/knowledge/${kb.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{kb.name}</CardTitle>
                  {kb.description && (
                    <CardDescription className="line-clamp-2">
                      {kb.description}
                    </CardDescription>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/knowledge/${kb.id}`)
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Ver Documentos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(kb.id)
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{kb.stats.documentCount} documentos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span>{formatTokens(kb.stats.totalTokens)} tokens</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={kb.isActive ? "default" : "secondary"}>
                    {kb.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {kb.embeddingModel}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
