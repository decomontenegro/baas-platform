/**
 * Document Chunker for Knowledge Base
 * Splits documents into overlapping chunks for embedding
 */

export interface ChunkConfig {
  chunkSize: number       // Target size in characters
  chunkOverlap: number    // Overlap between chunks
  separators?: string[]   // Custom separators for splitting
  preserveMetadata?: boolean
}

export interface Chunk {
  content: string
  position: number
  startIndex: number
  endIndex: number
  metadata?: Record<string, unknown>
}

const DEFAULT_CONFIG: ChunkConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  config: Partial<ChunkConfig> = {}
): Chunk[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const { chunkSize, chunkOverlap, separators = DEFAULT_CONFIG.separators } = mergedConfig
  
  if (!text || text.trim().length === 0) {
    return []
  }
  
  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, '\n').trim()
  
  // If text is smaller than chunk size, return as single chunk
  if (normalizedText.length <= chunkSize) {
    return [{
      content: normalizedText,
      position: 0,
      startIndex: 0,
      endIndex: normalizedText.length,
    }]
  }
  
  const chunks: Chunk[] = []
  let currentIndex = 0
  let position = 0
  
  while (currentIndex < normalizedText.length) {
    // Calculate end index for this chunk
    let endIndex = Math.min(currentIndex + chunkSize, normalizedText.length)
    
    // If we're not at the end, try to find a good break point
    if (endIndex < normalizedText.length) {
      const chunkText = normalizedText.slice(currentIndex, endIndex)
      const breakIndex = findBestBreakPoint(chunkText, separators!)
      
      if (breakIndex > chunkSize * 0.5) {
        // Only use break point if it's past halfway
        endIndex = currentIndex + breakIndex
      }
    }
    
    const chunkContent = normalizedText.slice(currentIndex, endIndex).trim()
    
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        position,
        startIndex: currentIndex,
        endIndex,
      })
      position++
    }
    
    // Move to next chunk with overlap
    currentIndex = endIndex - chunkOverlap
    
    // Ensure we make progress
    if (currentIndex <= chunks[chunks.length - 1]?.startIndex) {
      currentIndex = endIndex
    }
  }
  
  return chunks
}

/**
 * Find the best break point in text for chunking
 */
function findBestBreakPoint(text: string, separators: string[]): number {
  let bestIndex = text.length
  
  for (const separator of separators) {
    const lastIndex = text.lastIndexOf(separator)
    if (lastIndex > 0 && lastIndex < bestIndex) {
      bestIndex = lastIndex + separator.length
      break // Use first (most preferred) separator found
    }
  }
  
  return bestIndex
}

/**
 * Chunk a markdown document, preserving headers as context
 */
export function chunkMarkdown(
  markdown: string,
  config: Partial<ChunkConfig> = {}
): Chunk[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Split by headers first
  const sections = splitByHeaders(markdown)
  const chunks: Chunk[] = []
  let position = 0
  
  for (const section of sections) {
    const headerContext = section.headers.join(' > ')
    const contentWithContext = headerContext 
      ? `${headerContext}\n\n${section.content}`
      : section.content
    
    // Chunk each section
    const sectionChunks = chunkText(contentWithContext, mergedConfig)
    
    for (const chunk of sectionChunks) {
      chunks.push({
        ...chunk,
        position,
        startIndex: section.startIndex + chunk.startIndex,
        endIndex: section.startIndex + chunk.endIndex,
        metadata: {
          headers: section.headers,
        },
      })
      position++
    }
  }
  
  return chunks
}

interface MarkdownSection {
  headers: string[]
  content: string
  startIndex: number
}

/**
 * Split markdown by headers
 */
function splitByHeaders(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n')
  const sections: MarkdownSection[] = []
  
  let currentHeaders: string[] = []
  let currentContent: string[] = []
  let currentStartIndex = 0
  let charIndex = 0
  
  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    
    if (headerMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          headers: [...currentHeaders],
          content: currentContent.join('\n').trim(),
          startIndex: currentStartIndex,
        })
      }
      
      const level = headerMatch[1].length
      const title = headerMatch[2].trim()
      
      // Update header stack
      currentHeaders = currentHeaders.slice(0, level - 1)
      currentHeaders.push(title)
      currentContent = []
      currentStartIndex = charIndex
    } else {
      currentContent.push(line)
    }
    
    charIndex += line.length + 1 // +1 for newline
  }
  
  // Save last section
  if (currentContent.length > 0) {
    sections.push({
      headers: currentHeaders,
      content: currentContent.join('\n').trim(),
      startIndex: currentStartIndex,
    })
  }
  
  // Handle case where there's content before any headers
  if (sections.length === 0 && markdown.trim().length > 0) {
    sections.push({
      headers: [],
      content: markdown.trim(),
      startIndex: 0,
    })
  }
  
  return sections
}

/**
 * Merge small chunks into larger ones
 */
export function mergeSmallChunks(
  chunks: Chunk[],
  minChunkSize: number = 200
): Chunk[] {
  if (chunks.length === 0) return []
  
  const merged: Chunk[] = []
  let currentChunk: Chunk | null = null
  
  for (const chunk of chunks) {
    if (!currentChunk) {
      currentChunk = { ...chunk }
      continue
    }
    
    if (currentChunk.content.length < minChunkSize) {
      // Merge with next chunk
      currentChunk.content = `${currentChunk.content}\n\n${chunk.content}`
      currentChunk.endIndex = chunk.endIndex
    } else {
      merged.push(currentChunk)
      currentChunk = { ...chunk, position: merged.length }
    }
  }
  
  if (currentChunk) {
    currentChunk.position = merged.length
    merged.push(currentChunk)
  }
  
  return merged
}
