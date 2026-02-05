/**
 * Knowledge Base Integration for Clawdbot
 * Provides context from knowledge bases for bot responses
 */

import { searchMultipleKnowledgeBases, buildContext, type SearchResult } from './search'
import { prisma } from '@/lib/prisma'

export interface KnowledgeContextOptions {
  /** Tenant ID to search knowledge bases for */
  tenantId: string
  /** Query text to search for */
  query: string
  /** Optional workspace IDs to filter (if not provided, searches all) */
  workspaceIds?: string[]
  /** Optional knowledge base IDs to search (if provided, overrides workspace filtering) */
  knowledgeBaseIds?: string[]
  /** Maximum number of results */
  topK?: number
  /** Minimum similarity threshold (0-1) */
  threshold?: number
  /** Maximum context length in characters */
  maxContextLength?: number
  /** Include source document titles */
  includeSource?: boolean
  /** Output format */
  format?: 'plain' | 'markdown'
}

export interface KnowledgeContextResult {
  /** The formatted context to inject into the prompt */
  context: string
  /** Raw search results */
  results: SearchResult[]
  /** Knowledge base IDs that were searched */
  knowledgeBaseIds: string[]
  /** Whether any relevant context was found */
  hasContext: boolean
}

/**
 * Get relevant context from knowledge bases for a query
 * This is the main function Clawdbot should call when processing a message
 */
export async function getKnowledgeContext(
  options: KnowledgeContextOptions
): Promise<KnowledgeContextResult> {
  const {
    tenantId,
    query,
    workspaceIds,
    knowledgeBaseIds: providedKbIds,
    topK = 5,
    threshold = 0.7,
    maxContextLength = 4000,
    includeSource = true,
    format = 'markdown',
  } = options

  // If specific knowledge base IDs are provided, use those
  let knowledgeBaseIds = providedKbIds

  // Otherwise, get all active knowledge bases for the tenant
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        documents: {
          some: {
            status: 'COMPLETED',
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    })

    knowledgeBaseIds = knowledgeBases.map(kb => kb.id)
  }

  // No knowledge bases found
  if (knowledgeBaseIds.length === 0) {
    return {
      context: '',
      results: [],
      knowledgeBaseIds: [],
      hasContext: false,
    }
  }

  // Search across all knowledge bases
  const results = await searchMultipleKnowledgeBases(
    knowledgeBaseIds,
    query,
    { topK, threshold }
  )

  // No relevant results
  if (results.length === 0) {
    return {
      context: '',
      results: [],
      knowledgeBaseIds,
      hasContext: false,
    }
  }

  // Build context string
  const context = buildContext(results, {
    maxLength: maxContextLength,
    includeSource,
    format,
  })

  return {
    context,
    results,
    knowledgeBaseIds,
    hasContext: context.length > 0,
  }
}

/**
 * Build a system prompt with knowledge base context
 */
export function buildPromptWithContext(
  basePrompt: string,
  knowledgeContext: KnowledgeContextResult,
  options: {
    contextPrefix?: string
    contextSuffix?: string
  } = {}
): string {
  if (!knowledgeContext.hasContext) {
    return basePrompt
  }

  const {
    contextPrefix = '\n\n## Informações Relevantes da Base de Conhecimento\n\nUse as seguintes informações para responder à pergunta do usuário:\n\n',
    contextSuffix = '\n\n---\n\nResponda à pergunta do usuário usando as informações acima quando relevante. Se a informação não estiver disponível, responda com seu conhecimento geral.',
  } = options

  return `${basePrompt}${contextPrefix}${knowledgeContext.context}${contextSuffix}`
}

/**
 * Check if a query should trigger knowledge base search
 * Simple heuristic based on query type
 */
export function shouldSearchKnowledgeBase(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim()

  // Skip very short queries
  if (lowerQuery.length < 5) {
    return false
  }

  // Skip common greetings/small talk
  const skipPatterns = [
    /^(oi|olá|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e aí|eai|tudo bem)\b/i,
    /^(tchau|adeus|bye|até|xau|vlw|valeu|obrigad[oa]|thanks)\b/i,
    /^(sim|não|nao|ok|certo|entendi|beleza)\s*[!?.]*$/i,
  ]

  for (const pattern of skipPatterns) {
    if (pattern.test(lowerQuery)) {
      return false
    }
  }

  // Search for anything that looks like a question or request for information
  const searchPatterns = [
    /\?/,                           // Questions
    /^(o que|qual|quais|como|onde|quando|por ?que|quem)/i,  // Question words
    /^(me (diga|fale|explique|conte)|pode|poderia|gostaria)/i,  // Request patterns
    /(preciso|quero|desejo) (saber|entender|conhecer)/i,
  ]

  for (const pattern of searchPatterns) {
    if (pattern.test(lowerQuery)) {
      return true
    }
  }

  // Default: search for longer queries (likely looking for information)
  return lowerQuery.split(/\s+/).length >= 3
}

/**
 * Get knowledge bases for a specific workspace (for UI display)
 */
export async function getKnowledgeBasesForWorkspace(
  tenantId: string,
  workspaceId?: string
): Promise<Array<{ id: string; name: string; documentCount: number }>> {
  const knowledgeBases = await prisma.knowledgeBase.findMany({
    where: {
      tenantId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          documents: {
            where: { status: 'COMPLETED', deletedAt: null },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return knowledgeBases.map(kb => ({
    id: kb.id,
    name: kb.name,
    documentCount: kb._count.documents,
  }))
}
