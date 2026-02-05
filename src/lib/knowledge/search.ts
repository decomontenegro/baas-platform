/**
 * Semantic Search for Knowledge Base
 * Search through document chunks using vector similarity
 */

import { prisma } from '@/lib/prisma'
import { generateEmbedding, cosineSimilarity, type EmbeddingConfig } from './embeddings'

export interface SearchOptions {
  knowledgeBaseId: string
  query: string
  topK?: number
  threshold?: number
  embeddingConfig?: Partial<EmbeddingConfig>
}

export interface SearchResult {
  chunkId: string
  documentId: string
  documentTitle: string
  content: string
  score: number
  metadata: Record<string, unknown>
  position: number
}

/**
 * Search for relevant chunks in a knowledge base
 */
export async function searchKnowledgeBase(
  options: SearchOptions
): Promise<SearchResult[]> {
  const { knowledgeBaseId, query, topK = 5, threshold = 0.7, embeddingConfig } = options
  
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query, embeddingConfig)
  
  // Get all chunks from the knowledge base
  // Note: For production with large datasets, use pgvector extension
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      document: {
        knowledgeBaseId,
        status: 'COMPLETED',
        deletedAt: null,
      },
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  })
  
  // Calculate similarity scores
  const results: SearchResult[] = []
  
  for (const chunk of chunks) {
    if (!chunk.embedding) continue
    
    const chunkEmbedding = chunk.embedding as number[]
    const score = cosineSimilarity(queryEmbedding.embedding, chunkEmbedding)
    
    if (score >= threshold) {
      results.push({
        chunkId: chunk.id,
        documentId: chunk.document.id,
        documentTitle: chunk.document.title,
        content: chunk.content,
        score,
        metadata: chunk.metadata as Record<string, unknown>,
        position: chunk.position,
      })
    }
  }
  
  // Sort by score and take top K
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, topK)
}

/**
 * Search across multiple knowledge bases
 */
export async function searchMultipleKnowledgeBases(
  knowledgeBaseIds: string[],
  query: string,
  options: Omit<SearchOptions, 'knowledgeBaseId' | 'query'> = {}
): Promise<SearchResult[]> {
  const { topK = 5, threshold = 0.7, embeddingConfig } = options
  
  // Generate embedding for query once
  const queryEmbedding = await generateEmbedding(query, embeddingConfig)
  
  // Get all chunks from all knowledge bases
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      document: {
        knowledgeBaseId: { in: knowledgeBaseIds },
        status: 'COMPLETED',
        deletedAt: null,
      },
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          knowledgeBaseId: true,
        },
      },
    },
  })
  
  // Calculate similarity scores
  const results: SearchResult[] = []
  
  for (const chunk of chunks) {
    if (!chunk.embedding) continue
    
    const chunkEmbedding = chunk.embedding as number[]
    const score = cosineSimilarity(queryEmbedding.embedding, chunkEmbedding)
    
    if (score >= threshold) {
      results.push({
        chunkId: chunk.id,
        documentId: chunk.document.id,
        documentTitle: chunk.document.title,
        content: chunk.content,
        score,
        metadata: {
          ...chunk.metadata as Record<string, unknown>,
          knowledgeBaseId: chunk.document.knowledgeBaseId,
        },
        position: chunk.position,
      })
    }
  }
  
  // Sort by score and take top K
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, topK)
}

/**
 * Build context from search results for LLM prompt injection
 */
export function buildContext(
  results: SearchResult[],
  options: {
    maxLength?: number
    includeSource?: boolean
    format?: 'plain' | 'markdown'
  } = {}
): string {
  const { maxLength = 4000, includeSource = true, format = 'markdown' } = options
  
  if (results.length === 0) {
    return ''
  }
  
  const parts: string[] = []
  let currentLength = 0
  
  for (const result of results) {
    let part = ''
    
    if (format === 'markdown') {
      if (includeSource) {
        part = `### ${result.documentTitle}\n\n${result.content}\n\n---\n\n`
      } else {
        part = `${result.content}\n\n---\n\n`
      }
    } else {
      if (includeSource) {
        part = `[Fonte: ${result.documentTitle}]\n${result.content}\n\n`
      } else {
        part = `${result.content}\n\n`
      }
    }
    
    if (currentLength + part.length > maxLength) {
      break
    }
    
    parts.push(part)
    currentLength += part.length
  }
  
  return parts.join('').trim()
}

/**
 * Get related documents by finding similar chunks
 */
export async function getRelatedDocuments(
  documentId: string,
  options: { topK?: number; threshold?: number } = {}
): Promise<Array<{ documentId: string; title: string; score: number }>> {
  const { topK = 5, threshold = 0.7 } = options
  
  // Get chunks from source document
  const sourceChunks = await prisma.knowledgeChunk.findMany({
    where: { documentId },
    include: {
      document: {
        select: { knowledgeBaseId: true },
      },
    },
  })
  
  if (sourceChunks.length === 0) return []
  
  const knowledgeBaseId = sourceChunks[0].document.knowledgeBaseId
  
  // Get all other chunks in the same knowledge base
  const otherChunks = await prisma.knowledgeChunk.findMany({
    where: {
      documentId: { not: documentId },
      document: {
        knowledgeBaseId,
        status: 'COMPLETED',
        deletedAt: null,
      },
    },
    include: {
      document: {
        select: { id: true, title: true },
      },
    },
  })
  
  // Calculate average similarity for each document
  const documentScores: Map<string, { title: string; scores: number[] }> = new Map()
  
  for (const sourceChunk of sourceChunks) {
    if (!sourceChunk.embedding) continue
    const sourceEmbedding = sourceChunk.embedding as number[]
    
    for (const otherChunk of otherChunks) {
      if (!otherChunk.embedding) continue
      const otherEmbedding = otherChunk.embedding as number[]
      
      const score = cosineSimilarity(sourceEmbedding, otherEmbedding)
      
      const existing = documentScores.get(otherChunk.documentId)
      if (existing) {
        existing.scores.push(score)
      } else {
        documentScores.set(otherChunk.documentId, {
          title: otherChunk.document.title,
          scores: [score],
        })
      }
    }
  }
  
  // Calculate average scores and filter
  const results = Array.from(documentScores.entries())
    .map(([documentId, { title, scores }]) => ({
      documentId,
      title,
      score: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
  
  return results
}
