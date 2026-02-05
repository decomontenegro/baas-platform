import { ActionHandler, ActionContext, ActionResult, SearchConfig, QuickActionType } from '../types'
import { prisma } from '@/lib/prisma'

/**
 * /buscar [termo] - Search in knowledge base
 */
export const searchHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: SearchConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    const query = args.join(' ').trim()
    
    if (!query) {
      return {
        success: false,
        error: '🔍 Por favor, forneça um termo para buscar.\n\nUso: /buscar [termo]\nExemplo: /buscar política de reembolso',
        durationMs: Date.now() - startTime,
      }
    }

    const maxResults = config.maxResults || 5
    const minScore = config.minScore || 0.5

    // Get knowledge bases for this tenant
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        tenantId: context.tenantId,
        isActive: true,
        deletedAt: null,
        ...(config.knowledgeBaseId ? { id: config.knowledgeBaseId } : {}),
      },
      include: {
        documents: {
          where: {
            status: 'COMPLETED',
            deletedAt: null,
          },
          include: {
            chunks: true,
          },
        },
      },
    })

    if (knowledgeBases.length === 0) {
      return {
        success: true,
        output: '📚 Nenhuma base de conhecimento configurada. Entre em contato com o administrador.',
        durationMs: Date.now() - startTime,
      }
    }

    // Simple text search (in production, use vector similarity search)
    const results = searchInKnowledgeBases(query, knowledgeBases, maxResults)

    if (results.length === 0) {
      return {
        success: true,
        output: `🔍 Nenhum resultado encontrado para "${query}".\n\nTente termos diferentes ou mais genéricos.`,
        data: { query, resultsCount: 0 },
        durationMs: Date.now() - startTime,
      }
    }

    // Format results
    const formattedResults = results
      .map((r, i) => {
        const preview = r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content
        return `**${i + 1}. ${r.title}**\n${preview}`
      })
      .join('\n\n')

    return {
      success: true,
      output: `🔍 **Resultados para "${query}":**\n\n${formattedResults}\n\n_Encontrados ${results.length} resultado(s)_`,
      data: {
        query,
        resultsCount: results.length,
        results: results.map(r => ({ id: r.id, title: r.title, score: r.score })),
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao buscar: ${message}`,
      durationMs: Date.now() - startTime,
    }
  }
}

interface SearchResult {
  id: string
  title: string
  content: string
  score: number
  knowledgeBaseId: string
}

/**
 * Simple text search in knowledge bases (placeholder for vector search)
 */
function searchInKnowledgeBases(
  query: string,
  knowledgeBases: any[],
  maxResults: number
): SearchResult[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const results: SearchResult[] = []

  for (const kb of knowledgeBases) {
    for (const doc of kb.documents) {
      // Search in document content
      const docContent = doc.content.toLowerCase()
      const docTitle = doc.title.toLowerCase()
      
      // Simple scoring based on word matches
      let score = 0
      for (const word of queryWords) {
        if (docTitle.includes(word)) score += 2
        if (docContent.includes(word)) score += 1
      }

      if (score > 0) {
        results.push({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          score: score / queryWords.length,
          knowledgeBaseId: kb.id,
        })
      }

      // Also search in chunks for more granular results
      for (const chunk of doc.chunks) {
        const chunkContent = chunk.content.toLowerCase()
        let chunkScore = 0
        
        for (const word of queryWords) {
          if (chunkContent.includes(word)) chunkScore += 1
        }

        if (chunkScore > 0 && chunkScore > score) {
          // If chunk has better match, use chunk content
          results.push({
            id: `${doc.id}-${chunk.id}`,
            title: doc.title,
            content: chunk.content,
            score: chunkScore / queryWords.length,
            knowledgeBaseId: kb.id,
          })
        }
      }
    }
  }

  // Sort by score and deduplicate
  const seen = new Set<string>()
  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      // Deduplicate by content similarity
      const key = r.content.slice(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, maxResults)
}

export const searchAction = {
  type: QuickActionType.SEARCH,
  name: 'Buscar',
  description: 'Busca informações na base de conhecimento',
  trigger: '/buscar',
  aliases: ['/search', '/find', '/procurar'],
  handler: searchHandler,
  defaultConfig: {
    maxResults: 5,
    minScore: 0.5,
  } as SearchConfig,
  usage: '/buscar [termo]',
  examples: [
    '/buscar política de reembolso',
    '/buscar como cancelar pedido',
    '/buscar horário de funcionamento',
  ],
}
