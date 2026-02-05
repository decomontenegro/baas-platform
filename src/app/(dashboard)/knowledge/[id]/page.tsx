"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import {
  ArrowLeft,
  Brain,
  Upload,
  FileText,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Search,
  File,
  FileType,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Eye,
  Download,
  Settings,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
    chunkCount: number
    totalTokens: number
    statusCounts: Record<string, number>
  }
  documents: Document[]
}

interface Document {
  id: string
  title: string
  contentType: string
  fileName: string | null
  fileSize: number | null
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  tokenCount: number | null
  createdAt: string
  processedAt: string | null
  errorMessage: string | null
  _count?: { chunks: number }
}

interface SearchResult {
  chunkId: string
  documentId: string
  documentTitle: string
  content: string
  score: number
  position: number
}

const statusConfig = {
  PENDING: { icon: Clock, label: "Pendente", variant: "secondary" as const },
  PROCESSING: { icon: Loader2, label: "Processando", variant: "default" as const },
  COMPLETED: { icon: CheckCircle2, label: "Concluído", variant: "success" as const },
  FAILED: { icon: AlertCircle, label: "Falhou", variant: "destructive" as const },
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function KnowledgeBaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [knowledgeBase, setKnowledgeBase] = React.useState<KnowledgeBase | null>(null)
  const [documents, setDocuments] = React.useState<Document[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebounce(search, 300)
  
  // Upload state
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = React.useState("")
  const [uploadContent, setUploadContent] = React.useState("")
  const [uploadMode, setUploadMode] = React.useState<"file" | "text">("file")

  // Query state
  const [queryOpen, setQueryOpen] = React.useState(false)
  const [queryText, setQueryText] = React.useState("")
  const [queryResults, setQueryResults] = React.useState<SearchResult[]>([])
  const [querying, setQuerying] = React.useState(false)

  // Preview state
  const [previewDoc, setPreviewDoc] = React.useState<Document | null>(null)
  const [previewContent, setPreviewContent] = React.useState<string>("")
  const [previewLoading, setPreviewLoading] = React.useState(false)

  const fetchKnowledgeBase = React.useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/knowledge/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/knowledge")
          return
        }
        throw new Error("Failed to fetch")
      }
      const data = await response.json()
      setKnowledgeBase(data.knowledgeBase)
      setDocuments(data.knowledgeBase.documents || [])
    } catch (error) {
      console.error("Error fetching knowledge base:", error)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  const fetchDocuments = React.useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      params.set("limit", "100")

      const response = await fetch(`/api/knowledge/${id}/documents?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")

      const data = await response.json()
      setDocuments(data.documents)
    } catch (error) {
      console.error("Error fetching documents:", error)
    }
  }, [id, debouncedSearch])

  // Initial load
  React.useEffect(() => {
    fetchKnowledgeBase()
  }, [fetchKnowledgeBase])

  // Re-fetch documents when debounced search changes
  React.useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async () => {
    try {
      setUploading(true)
      const formData = new FormData()

      if (uploadMode === "file" && uploadFile) {
        formData.append("file", uploadFile)
        formData.append("title", uploadTitle || uploadFile.name)
      } else {
        formData.append("content", uploadContent)
        formData.append("title", uploadTitle || "Documento sem título")
      }

      const response = await fetch(`/api/knowledge/${id}/documents`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Failed to upload")

      setUploadFile(null)
      setUploadTitle("")
      setUploadContent("")
      setUploadOpen(false)
      fetchDocuments()
      fetchKnowledgeBase()
    } catch (error) {
      console.error("Error uploading document:", error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return

    try {
      const response = await fetch(`/api/knowledge/${id}/documents/${docId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      fetchDocuments()
      fetchKnowledgeBase()
    } catch (error) {
      console.error("Error deleting document:", error)
    }
  }

  const handleReprocess = async (docId: string) => {
    try {
      // Update status locally first
      setDocuments(docs =>
        docs.map(d => d.id === docId ? { ...d, status: "PROCESSING" as const } : d)
      )

      const response = await fetch(`/api/knowledge/${id}/documents/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to reprocess")

      fetchDocuments()
    } catch (error) {
      console.error("Error reprocessing document:", error)
      fetchDocuments()
    }
  }

  const handleQuery = async () => {
    if (!queryText.trim()) return

    try {
      setQuerying(true)
      const response = await fetch(`/api/knowledge/${id}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText, topK: 5, threshold: 0.5 }),
      })

      if (!response.ok) throw new Error("Failed to query")

      const data = await response.json()
      setQueryResults(data.results)
    } catch (error) {
      console.error("Error querying:", error)
    } finally {
      setQuerying(false)
    }
  }

  const handlePreview = async (doc: Document) => {
    try {
      setPreviewDoc(doc)
      setPreviewLoading(true)
      
      const response = await fetch(`/api/knowledge/${id}/documents/${doc.id}`)
      if (!response.ok) throw new Error("Failed to fetch")

      const data = await response.json()
      setPreviewContent(data.document.content || "")
    } catch (error) {
      console.error("Error fetching preview:", error)
      setPreviewContent("Erro ao carregar conteúdo")
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!knowledgeBase) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => router.push("/knowledge")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-8 w-8" />
              {knowledgeBase.name}
            </h1>
            {knowledgeBase.description && (
              <p className="text-muted-foreground mt-1">
                {knowledgeBase.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={queryOpen} onOpenChange={setQueryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Testar Busca
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Testar Busca Semântica</DialogTitle>
                  <DialogDescription>
                    Digite uma pergunta para testar a busca na knowledge base.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite sua pergunta..."
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                    />
                    <Button onClick={handleQuery} disabled={querying || !queryText.trim()}>
                      {querying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {queryResults.length > 0 && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {queryResults.map((result, idx) => (
                        <Card key={result.chunkId}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium">
                                {result.documentTitle}
                              </CardTitle>
                              <Badge variant="outline">
                                {(result.score * 100).toFixed(0)}% match
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="py-3">
                            <p className="text-sm text-muted-foreground line-clamp-4">
                              {result.content}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload de Documento</DialogTitle>
                  <DialogDescription>
                    Adicione um novo documento à knowledge base.
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as "file" | "text")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">Arquivo</TabsTrigger>
                    <TabsTrigger value="text">Texto</TabsTrigger>
                  </TabsList>

                  <TabsContent value="file" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">Arquivo</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".txt,.md,.pdf,.docx,.doc,.html,.json,.csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setUploadFile(file)
                            if (!uploadTitle) setUploadTitle(file.name)
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Formatos: TXT, MD, PDF, DOCX, HTML, JSON, CSV
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Título (opcional)</Label>
                      <Input
                        id="title"
                        placeholder="Nome do documento"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="text" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="text-title">Título</Label>
                      <Input
                        id="text-title"
                        placeholder="Nome do documento"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content">Conteúdo</Label>
                      <Textarea
                        id="content"
                        placeholder="Cole ou digite o conteúdo do documento..."
                        value={uploadContent}
                        onChange={(e) => setUploadContent(e.target.value)}
                        rows={10}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setUploadOpen(false)}
                    disabled={uploading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={
                      uploading ||
                      (uploadMode === "file" ? !uploadFile : !uploadContent.trim())
                    }
                  >
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Upload
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {knowledgeBase.stats.documentCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chunks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {knowledgeBase.stats.chunkCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tokens Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {knowledgeBase.stats.totalTokens.toLocaleString("pt-BR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modelo de Embeddings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium truncate">
              {knowledgeBase.embeddingModel}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Lista de documentos nesta knowledge base
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={fetchDocuments}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum documento</h3>
              <p className="text-muted-foreground text-center mt-1">
                Faça upload do primeiro documento para esta knowledge base.
              </p>
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Documento
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const status = statusConfig[doc.status]
                  const StatusIcon = status.icon
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileType className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{doc.title}</div>
                            {doc.fileName && (
                              <div className="text-xs text-muted-foreground">
                                {doc.fileName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status.variant}
                          className="flex items-center gap-1 w-fit"
                        >
                          <StatusIcon
                            className={`h-3 w-3 ${
                              doc.status === "PROCESSING" ? "animate-spin" : ""
                            }`}
                          />
                          {status.label}
                        </Badge>
                        {doc.errorMessage && (
                          <p className="text-xs text-destructive mt-1 max-w-48 truncate">
                            {doc.errorMessage}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{doc._count?.chunks || "-"}</TableCell>
                      <TableCell>
                        {doc.tokenCount?.toLocaleString("pt-BR") || "-"}
                      </TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreview(doc)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            {doc.status === "FAILED" && (
                              <DropdownMenuItem onClick={() => handleReprocess(doc.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reprocessar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(doc.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
            <DialogDescription>
              Pré-visualização do conteúdo do documento
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                {previewContent}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
