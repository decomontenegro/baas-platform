'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Grid3X3,
  List,
  Sparkles,
  Headphones,
  TrendingUp,
  Calendar,
  Users,
  Wrench,
  ClipboardList,
  X,
  Star,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TemplateCard } from '@/components/templates/TemplateCard'
import { TemplatePreview } from '@/components/templates/TemplatePreview'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Template, TemplateCategory } from '@/types/templates'

const categoryIcons: Record<string, any> = {
  headphones: Headphones,
  'trending-up': TrendingUp,
  calendar: Calendar,
  users: Users,
  wrench: Wrench,
  'clipboard-list': ClipboardList,
}

type ViewMode = 'grid' | 'list'
type SortBy = 'popular' | 'newest' | 'rating' | 'name'

export default function TemplatesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('popular')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  // Data states
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/templates/categories')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data)
        }
      } catch (err) {
        console.error('Error fetching categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch templates with filters
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set('search', searchQuery)
        if (selectedCategory) params.set('categoryId', selectedCategory)
        if (showFeaturedOnly) params.set('isFeatured', 'true')
        params.set('sortBy', sortBy)
        params.set('limit', '100')

        const res = await fetch(`/api/templates?${params}`)
        const data = await res.json()

        if (data.success) {
          setTemplates(data.data)
        } else {
          setError(data.error || 'Erro ao carregar templates')
        }
      } catch (err) {
        console.error('Error fetching templates:', err)
        setError('Erro ao conectar com o servidor')
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce search
    const timeoutId = setTimeout(fetchTemplates, searchQuery ? 300 : 0)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, selectedCategory, sortBy, showFeaturedOnly])

  // Group templates by category for grid view
  const templatesByCategory = useMemo(() => {
    if (selectedCategory || searchQuery) return null

    return categories.map((category) => ({
      ...category,
      templates: templates.filter((t) => t.categoryId === category.id),
    })).filter((cat) => cat.templates.length > 0)
  }, [templates, categories, selectedCategory, searchQuery])

  const handleUseTemplate = (template: Template) => {
    router.push(`/templates/${template.id}`)
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Biblioteca de templates prontos para começar rapidamente
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Options */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Featured Toggle */}
          <button
            onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              showFeaturedOnly
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            <Star className={cn('w-4 h-4', showFeaturedOnly && 'fill-current')} />
            Destaques
          </button>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="popular">Mais populares</option>
            <option value="rating">Melhor avaliados</option>
            <option value="newest">Mais recentes</option>
            <option value="name">Nome A-Z</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            !selectedCategory
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          )}
        >
          Todos
        </button>
        {categories.map((category) => {
          const Icon = categoryIcons[category.icon] || Sparkles
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                category.id === selectedCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              <Icon className="w-4 h-4" />
              {category.name}
            </button>
          )
        })}
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{templates.length} templates encontrados</span>
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-primary hover:underline"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar</h3>
          <p className="text-muted-foreground max-w-md">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Templates Grid/List */}
      {!isLoading && !error && (selectedCategory || searchQuery) ? (
        // Flat list when filtered
        <motion.div
          layout
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-4'
          )}
        >
          <AnimatePresence mode="popLayout">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                compact={viewMode === 'list'}
                onClick={() => setPreviewTemplate(template)}
                onPreview={() => setPreviewTemplate(template)}
                onUse={() => handleUseTemplate(template)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : !isLoading && !error ? (
        // Grouped by category
        <div className="space-y-12">
          {templatesByCategory?.map((category) => {
            const Icon = categoryIcons[category.icon] || Sparkles
            return (
              <section key={category.id}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{category.name}</h2>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCategory(category.id)}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver todos →
                  </button>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {category.templates.slice(0, 4).map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => setPreviewTemplate(template)}
                      onPreview={() => setPreviewTemplate(template)}
                      onUse={() => handleUseTemplate(template)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}

      {/* Empty State */}
      {!isLoading && !error && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
          <p className="text-muted-foreground max-w-md">
            Tente ajustar os filtros ou buscar por outros termos.
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory(null)
              setShowFeaturedOnly(false)
            }}
            className="mt-4 text-primary hover:underline"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setPreviewTemplate(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{previewTemplate.icon}</span>
                  <div>
                    <h3 className="font-semibold">{previewTemplate.name}</h3>
                    <div className="flex items-center gap-2">
                      {previewTemplate.isOfficial && (
                        <Badge variant="secondary" className="text-xs">Oficial</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {previewTemplate.usageCount.toLocaleString('pt-BR')} usos
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="h-[500px]">
                <TemplatePreview template={previewTemplate} className="h-full rounded-none border-0" />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t bg-muted/50">
                <p className="text-sm text-muted-foreground max-w-md">
                  {previewTemplate.description}
                </p>
                <button
                  onClick={() => handleUseTemplate(previewTemplate)}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Usar Template
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
