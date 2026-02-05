/**
 * Embeddings module for Knowledge Base
 * Generates vector embeddings for text chunks using OpenAI or local models
 */

export interface EmbeddingConfig {
  model: string
  dimensions?: number
  apiKey?: string
  baseUrl?: string
}

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
  model: string
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
}

/**
 * Generate embeddings for a single text
 */
export async function generateEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required for embeddings')
  }
  
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
  
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: mergedConfig.model,
      input: text,
      dimensions: mergedConfig.dimensions,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API error: ${response.status} - ${error}`)
  }
  
  const data = await response.json()
  
  return {
    embedding: data.data[0].embedding,
    tokenCount: data.usage.total_tokens,
    model: mergedConfig.model,
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(
  texts: string[],
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required for embeddings')
  }
  
  if (texts.length === 0) {
    return []
  }
  
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
  
  // OpenAI supports batch embeddings
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: mergedConfig.model,
      input: texts,
      dimensions: mergedConfig.dimensions,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API error: ${response.status} - ${error}`)
  }
  
  const data = await response.json()
  const tokenPerItem = Math.ceil(data.usage.total_tokens / texts.length)
  
  return data.data.map((item: { embedding: number[]; index: number }) => ({
    embedding: item.embedding,
    tokenCount: tokenPerItem,
    model: mergedConfig.model,
  }))
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions')
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions')
  }
  
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2)
  }
  
  return Math.sqrt(sum)
}

/**
 * Estimate token count for text (approximate)
 * Uses rough heuristic: ~4 characters per token for English
 */
export function estimateTokenCount(text: string): number {
  // More accurate for code and mixed content: ~3.5 chars per token
  return Math.ceil(text.length / 3.5)
}
