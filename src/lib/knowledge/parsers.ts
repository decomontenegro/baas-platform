/**
 * Document Parsers for Knowledge Base
 * Parse different file formats into plain text
 */

export interface ParseResult {
  content: string
  metadata: Record<string, unknown>
  contentType: string
}

export type ParserFunction = (buffer: Buffer, fileName?: string) => Promise<ParseResult>

/**
 * Parse plain text file
 */
export async function parseText(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  return {
    content: buffer.toString('utf-8'),
    metadata: {
      format: 'text',
      fileName,
    },
    contentType: 'text/plain',
  }
}

/**
 * Parse Markdown file
 */
export async function parseMarkdown(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  const content = buffer.toString('utf-8')
  
  // Extract title from first h1 if present
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : undefined
  
  return {
    content,
    metadata: {
      format: 'markdown',
      title,
      fileName,
    },
    contentType: 'text/markdown',
  }
}

/**
 * Parse PDF file (basic implementation)
 * Note: For production, use pdf-parse or pdfjs-dist
 */
export async function parsePDF(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  // Try to dynamically import pdf-parse if available
  try {
    const pdfParse = await import('pdf-parse').then(m => m.default || m).catch(() => null)
    
    if (pdfParse) {
      const data = await pdfParse(buffer)
      return {
        content: data.text,
        metadata: {
          format: 'pdf',
          pages: data.numpages,
          info: data.info,
          fileName,
        },
        contentType: 'application/pdf',
      }
    }
  } catch {
    // pdf-parse not available
  }
  
  // Fallback: Extract text using basic regex (very limited)
  const text = buffer.toString('latin1')
  
  // Try to extract text between stream markers (very basic PDF text extraction)
  const textParts: string[] = []
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g
  let match
  
  while ((match = streamRegex.exec(text)) !== null) {
    const streamContent = match[1]
    // Extract text operations (Tj, TJ, ')
    const textOps = streamContent.match(/\(([^)]*)\)\s*Tj/g)
    if (textOps) {
      for (const op of textOps) {
        const textMatch = op.match(/\(([^)]*)\)/)
        if (textMatch) {
          textParts.push(textMatch[1])
        }
      }
    }
  }
  
  return {
    content: textParts.join(' ') || '[PDF parsing requires pdf-parse package]',
    metadata: {
      format: 'pdf',
      parsingMethod: 'basic',
      fileName,
    },
    contentType: 'application/pdf',
  }
}

/**
 * Parse DOCX file (basic implementation)
 * Note: For production, use mammoth or docx
 */
export async function parseDocx(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  // Try to dynamically import mammoth if available
  try {
    const mammoth = await import('mammoth').then(m => m.default || m).catch(() => null)
    
    if (mammoth) {
      const result = await mammoth.extractRawText({ buffer })
      return {
        content: result.value,
        metadata: {
          format: 'docx',
          messages: result.messages,
          fileName,
        },
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
    }
  } catch {
    // mammoth not available
  }
  
  // Fallback: DOCX is a ZIP with XML inside
  // Try basic extraction
  try {
    const JSZip = await import('jszip').then(m => m.default || m).catch(() => null)
    
    if (JSZip) {
      const zip = await JSZip.loadAsync(buffer)
      const docXml = await zip.file('word/document.xml')?.async('text')
      
      if (docXml) {
        // Extract text from XML (basic)
        const textContent = docXml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        return {
          content: textContent,
          metadata: {
            format: 'docx',
            parsingMethod: 'basic-xml',
            fileName,
          },
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
      }
    }
  } catch {
    // jszip not available
  }
  
  return {
    content: '[DOCX parsing requires mammoth or jszip package]',
    metadata: {
      format: 'docx',
      error: 'parsing-unavailable',
      fileName,
    },
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}

/**
 * Parse HTML file
 */
export async function parseHTML(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  const html = buffer.toString('utf-8')
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : undefined
  
  // Remove script and style tags
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
  
  // Replace common block elements with newlines
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
  
  // Remove all remaining tags
  content = content.replace(/<[^>]+>/g, '')
  
  // Decode HTML entities
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
  
  // Normalize whitespace
  content = content
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  
  return {
    content,
    metadata: {
      format: 'html',
      title,
      fileName,
    },
    contentType: 'text/html',
  }
}

/**
 * Parse JSON file (extracts string values)
 */
export async function parseJSON(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  const json = buffer.toString('utf-8')
  const data = JSON.parse(json)
  
  // Extract all string values recursively
  const strings: string[] = []
  extractStrings(data, strings)
  
  return {
    content: strings.join('\n'),
    metadata: {
      format: 'json',
      fileName,
    },
    contentType: 'application/json',
  }
}

function extractStrings(obj: unknown, strings: string[], depth = 0): void {
  if (depth > 10) return // Prevent deep recursion
  
  if (typeof obj === 'string' && obj.trim().length > 0) {
    strings.push(obj)
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      extractStrings(item, strings, depth + 1)
    }
  } else if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      extractStrings(value, strings, depth + 1)
    }
  }
}

/**
 * Parse CSV file
 */
export async function parseCSV(buffer: Buffer, fileName?: string): Promise<ParseResult> {
  const csv = buffer.toString('utf-8')
  const lines = csv.split('\n')
  
  if (lines.length === 0) {
    return {
      content: '',
      metadata: { format: 'csv', fileName },
      contentType: 'text/csv',
    }
  }
  
  // Get headers
  const headers = parseCSVLine(lines[0])
  
  // Convert to readable text
  const rows: string[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue
    
    const rowParts: string[] = []
    for (let j = 0; j < headers.length && j < values.length; j++) {
      if (values[j].trim()) {
        rowParts.push(`${headers[j]}: ${values[j]}`)
      }
    }
    
    if (rowParts.length > 0) {
      rows.push(rowParts.join(', '))
    }
  }
  
  return {
    content: rows.join('\n'),
    metadata: {
      format: 'csv',
      headers,
      rowCount: rows.length,
      fileName,
    },
    contentType: 'text/csv',
  }
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  values.push(current.trim())
  return values
}

/**
 * Get parser for file type
 */
export function getParser(mimeType: string, fileName?: string): ParserFunction {
  // Check by mime type first
  const mimeMap: Record<string, ParserFunction> = {
    'text/plain': parseText,
    'text/markdown': parseMarkdown,
    'text/html': parseHTML,
    'application/pdf': parsePDF,
    'application/json': parseJSON,
    'text/csv': parseCSV,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseDocx,
    'application/msword': parseDocx,
  }
  
  if (mimeMap[mimeType]) {
    return mimeMap[mimeType]
  }
  
  // Fallback to extension if fileName provided
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop()
    const extMap: Record<string, ParserFunction> = {
      txt: parseText,
      md: parseMarkdown,
      markdown: parseMarkdown,
      html: parseHTML,
      htm: parseHTML,
      pdf: parsePDF,
      json: parseJSON,
      csv: parseCSV,
      docx: parseDocx,
      doc: parseDocx,
    }
    
    if (ext && extMap[ext]) {
      return extMap[ext]
    }
  }
  
  // Default to plain text
  return parseText
}

/**
 * Parse a file automatically based on type
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<ParseResult> {
  const parser = getParser(mimeType, fileName)
  return parser(buffer, fileName)
}
