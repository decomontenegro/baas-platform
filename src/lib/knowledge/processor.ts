/**
 * Document Processor for Knowledge Base
 * Orchestrates parsing, chunking, and embedding generation
 */

import { prisma } from '@/lib/prisma'
import { chunkText, chunkMarkdown, type ChunkConfig } from './chunker'
import { generateEmbeddings, estimateTokenCount, type EmbeddingConfig } from './embeddings'
import { parseFile } from './parsers'

export interface ProcessOptions {
  chunkConfig?: Partial<ChunkConfig>
  embeddingConfig?: Partial<EmbeddingConfig>
  batchSize?: number
}

export interface ProcessResult {
  documentId: string
  chunksCreated: number
  totalTokens: number
  error?: string
}

/**
 * Process a document: parse, chunk, and generate embeddings
 */
export async function processDocument(
  documentId: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const { batchSize = 20 } = options
  
  try {
    // Get document
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: {
        KnowledgeBase: true,
      },
    })
    
    if (!document) {
      throw new Error('Document not found')
    }
    
    // Update status to processing
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    })
    
    // Get chunk config from knowledge base settings
    const chunkConfig: Partial<ChunkConfig> = {
      chunkSize: document.KnowledgeBase.chunkSize,
      chunkOverlap: document.KnowledgeBase.chunkOverlap,
      ...options.chunkConfig,
    }
    
    // Get embedding config
    const embeddingConfig: Partial<EmbeddingConfig> = {
      model: document.KnowledgeBase.embeddingModel,
      ...options.embeddingConfig,
    }
    
    // Chunk the content
    let chunks
    if (document.contentType === 'text/markdown') {
      chunks = chunkMarkdown(document.content, chunkConfig)
    } else {
      chunks = chunkText(document.content, chunkConfig)
    }
    
    if (chunks.length === 0) {
      throw new Error('No chunks generated from document')
    }
    
    // Delete existing chunks
    await prisma.knowledgeChunk.deleteMany({
      where: { documentId },
    })
    
    // Process in batches
    let totalTokens = 0
    const createdChunks: Array<{
      content: string
      position: number
      startIndex: number
      endIndex: number
      embedding: number[]
      tokenCount: number
      documentId: string
      metadata: Record<string, unknown>
    }> = []
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const texts = batch.map(c => c.content)
      
      // Generate embeddings for batch
      const embeddings = await generateEmbeddings(texts, embeddingConfig)
      
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        const embedding = embeddings[j]
        
        totalTokens += embedding.tokenCount
        
        createdChunks.push({
          content: chunk.content,
          position: chunk.position,
          startIndex: chunk.startIndex ?? 0,
          endIndex: chunk.endIndex ?? chunk.content.length,
          embedding: embedding.embedding,
          tokenCount: embedding.tokenCount,
          documentId,
          metadata: chunk.metadata ?? {},
        })
      }
    }
    
    // Create all chunks in database
    await prisma.knowledgeChunk.createMany({
      data: createdChunks,
    })
    
    // Update document status
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        tokenCount: totalTokens,
        errorMessage: null,
      },
    })
    
    return {
      documentId,
      chunksCreated: createdChunks.length,
      totalTokens,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Update document status to failed
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    })
    
    return {
      documentId,
      chunksCreated: 0,
      totalTokens: 0,
      error: errorMessage,
    }
  }
}

/**
 * Reprocess all documents in a knowledge base
 */
export async function reprocessKnowledgeBase(
  knowledgeBaseId: string,
  options: ProcessOptions = {}
): Promise<{
  processed: number
  failed: number
  errors: Array<{ documentId: string; error: string }>
}> {
  const documents = await prisma.knowledgeDocument.findMany({
    where: {
      knowledgeBaseId,
      deletedAt: null,
    },
    select: { id: true },
  })
  
  let processed = 0
  let failed = 0
  const errors: Array<{ documentId: string; error: string }> = []
  
  for (const doc of documents) {
    const result = await processDocument(doc.id, options)
    
    if (result.error) {
      failed++
      errors.push({ documentId: doc.id, error: result.error })
    } else {
      processed++
    }
  }
  
  return { processed, failed, errors }
}

/**
 * Add a document to knowledge base and process it
 */
export async function addDocument(
  knowledgeBaseId: string,
  options: {
    title: string
    content?: string
    file?: {
      buffer: Buffer
      mimeType: string
      fileName?: string
      size?: number
    }
    metadata?: Record<string, unknown>
    processImmediately?: boolean
  }
): Promise<{ document: { id: string; title: string; status: string }; processResult?: ProcessResult }> {
  let content = options.content || ''
  let contentType = 'text/plain'
  let fileInfo: { fileName?: string; fileSize?: number } = {}
  
  // Parse file if provided
  if (options.file) {
    const parseResult = await parseFile(
      options.file.buffer,
      options.file.mimeType,
      options.file.fileName
    )
    content = parseResult.content
    contentType = parseResult.contentType
    fileInfo = {
      fileName: options.file.fileName,
      fileSize: options.file.size,
    }
  }
  
  // Estimate token count
  const estimatedTokens = estimateTokenCount(content)
  
  // Create document
  const document = await prisma.knowledgeDocument.create({
    data: {
      title: options.title,
      content,
      contentType,
      fileName: fileInfo.fileName,
      fileSize: fileInfo.fileSize,
      knowledgeBaseId,
      metadata: options.metadata || {},
      tokenCount: estimatedTokens,
      status: 'PENDING',
    },
  })
  
  // Process immediately if requested
  if (options.processImmediately !== false) {
    const processResult = await processDocument(document.id)
    return {
      document: {
        id: document.id,
        title: document.title,
        status: processResult.error ? 'FAILED' : 'COMPLETED',
      },
      processResult,
    }
  }
  
  return {
    document: {
      id: document.id,
      title: document.title,
      status: 'PENDING',
    },
  }
}

/**
 * Get statistics for a knowledge base
 */
export async function getKnowledgeBaseStats(knowledgeBaseId: string): Promise<{
  documentCount: number
  chunkCount: number
  totalTokens: number
  statusCounts: Record<string, number>
}> {
  const [documents, chunks, statusAgg] = await Promise.all([
    prisma.knowledgeDocument.count({
      where: { knowledgeBaseId, deletedAt: null },
    }),
    prisma.knowledgeChunk.count({
      where: { document: { knowledgeBaseId, deletedAt: null } },
    }),
    prisma.knowledgeDocument.groupBy({
      by: ['status'],
      where: { knowledgeBaseId, deletedAt: null },
      _count: { status: true },
    }),
  ])
  
  // Calculate total tokens
  const tokenSum = await prisma.knowledgeDocument.aggregate({
    where: { knowledgeBaseId, deletedAt: null },
    _sum: { tokenCount: true },
  })
  
  const statusCounts: Record<string, number> = {}
  for (const item of statusAgg) {
    statusCounts[item.status] = item._count.status
  }
  
  return {
    documentCount: documents,
    chunkCount: chunks,
    totalTokens: tokenSum._sum.tokenCount || 0,
    statusCounts,
  }
}
