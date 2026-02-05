/**
 * Knowledge Base Test Script
 * 
 * Para rodar: npx tsx scripts/test-knowledge-base.ts
 * 
 * Requer variáveis de ambiente:
 * - DATABASE_URL (para acesso direto)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
}

function log(type: 'pass' | 'fail' | 'info' | 'warn', message: string) {
  const icons = {
    pass: `${colors.green}✓${colors.reset}`,
    fail: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
  }
  console.log(`${icons[type]} ${message}`)
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn()
      results.push({ name, passed: true })
      log('pass', name)
    } catch (error: any) {
      results.push({ name, passed: false, error: error.message })
      log('fail', `${name}: ${error.message}`)
    }
  }
}

// ========== TESTES DE DATABASE (DIRETO) ==========

async function testDatabaseStructure() {
  log('info', '\n=== Testes de Estrutura do Database ===\n')

  await test('KnowledgeBase table exists', async () => {
    const count = await prisma.knowledgeBase.count()
    if (typeof count !== 'number') throw new Error('Table not accessible')
  })()

  await test('KnowledgeDocument table exists', async () => {
    const count = await prisma.knowledgeDocument.count()
    if (typeof count !== 'number') throw new Error('Table not accessible')
  })()

  await test('KnowledgeChunk table exists', async () => {
    const count = await prisma.knowledgeChunk.count()
    if (typeof count !== 'number') throw new Error('Table not accessible')
  })()

  await test('pgvector extension available', async () => {
    const result = await prisma.$queryRaw<any[]>`SELECT extname FROM pg_extension WHERE extname = 'vector'`
    if (result.length === 0) throw new Error('pgvector extension not installed')
  })()
}

// ========== TESTES DE API ROUTES ==========

async function testApiRoutes() {
  log('info', '\n=== Testes de API Routes (Estrutura) ===\n')
  
  const fs = await import('fs')
  const path = await import('path')
  
  const routesDir = path.join(process.cwd(), 'src/app/api/knowledge')
  
  await test('GET /api/knowledge route exists', async () => {
    const routePath = path.join(routesDir, 'route.ts')
    if (!fs.existsSync(routePath)) throw new Error('Route file not found')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function GET')) throw new Error('GET handler not found')
  })()

  await test('POST /api/knowledge route exists', async () => {
    const routePath = path.join(routesDir, 'route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function POST')) throw new Error('POST handler not found')
  })()

  await test('GET /api/knowledge/[id] route exists', async () => {
    const routePath = path.join(routesDir, '[id]/route.ts')
    if (!fs.existsSync(routePath)) throw new Error('Route file not found')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function GET')) throw new Error('GET handler not found')
  })()

  await test('DELETE /api/knowledge/[id] route exists', async () => {
    const routePath = path.join(routesDir, '[id]/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function DELETE')) throw new Error('DELETE handler not found')
  })()

  await test('GET /api/knowledge/[id]/documents route exists', async () => {
    const routePath = path.join(routesDir, '[id]/documents/route.ts')
    if (!fs.existsSync(routePath)) throw new Error('Route file not found')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function GET')) throw new Error('GET handler not found')
  })()

  await test('POST /api/knowledge/[id]/documents route exists', async () => {
    const routePath = path.join(routesDir, '[id]/documents/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function POST')) throw new Error('POST handler not found')
  })()

  await test('POST /api/knowledge/[id]/query route exists', async () => {
    const routePath = path.join(routesDir, '[id]/query/route.ts')
    if (!fs.existsSync(routePath)) throw new Error('Route file not found')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function POST')) throw new Error('POST handler not found')
  })()

  await test('POST /api/knowledge/[id]/documents/[docId] (reprocess) route exists', async () => {
    const routePath = path.join(routesDir, '[id]/documents/[docId]/route.ts')
    if (!fs.existsSync(routePath)) throw new Error('Route file not found')
    const content = fs.readFileSync(routePath, 'utf-8')
    if (!content.includes('export async function POST')) throw new Error('POST handler not found')
  })()
}

// ========== TESTES DE LIB/KNOWLEDGE ==========

async function testKnowledgeLib() {
  log('info', '\n=== Testes de lib/knowledge ===\n')

  await test('chunker module exports correctly', async () => {
    const { chunkText, chunkDocument } = await import('@/lib/knowledge/chunker')
    if (typeof chunkText !== 'function') throw new Error('chunkText not a function')
    if (typeof chunkDocument !== 'function') throw new Error('chunkDocument not a function')
  })()

  await test('embeddings module exports correctly', async () => {
    const { generateEmbedding, generateEmbeddings } = await import('@/lib/knowledge/embeddings')
    if (typeof generateEmbedding !== 'function') throw new Error('generateEmbedding not a function')
    if (typeof generateEmbeddings !== 'function') throw new Error('generateEmbeddings not a function')
  })()

  await test('search module exports correctly', async () => {
    const { searchKnowledgeBase, buildContext } = await import('@/lib/knowledge/search')
    if (typeof searchKnowledgeBase !== 'function') throw new Error('searchKnowledgeBase not a function')
    if (typeof buildContext !== 'function') throw new Error('buildContext not a function')
  })()

  await test('processor module exports correctly', async () => {
    const { processDocument, addDocument } = await import('@/lib/knowledge/processor')
    if (typeof processDocument !== 'function') throw new Error('processDocument not a function')
    if (typeof addDocument !== 'function') throw new Error('addDocument not a function')
  })()

  await test('parsers module exports correctly', async () => {
    const { parseFile, extractTextFromFile } = await import('@/lib/knowledge/parsers')
    if (typeof parseFile !== 'function') throw new Error('parseFile not a function')
    if (typeof extractTextFromFile !== 'function') throw new Error('extractTextFromFile not a function')
  })()
}

// ========== TESTES DE PAGES (DASHBOARD) ==========

async function testDashboardPages() {
  log('info', '\n=== Testes de Dashboard Pages ===\n')
  
  const fs = await import('fs')
  const path = await import('path')
  
  await test('/knowledge page exists', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/page.tsx')
    if (!fs.existsSync(pagePath)) throw new Error('Page not found')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('export default function')) throw new Error('Page component not found')
  })()

  await test('/knowledge page has create dialog', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('Criar Knowledge Base')) throw new Error('Create dialog not found')
  })()

  await test('/knowledge page has search', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('useDebounce') && !content.includes('setSearch')) throw new Error('Search not found')
  })()

  await test('/knowledge/[id] page exists', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/[id]/page.tsx')
    if (!fs.existsSync(pagePath)) throw new Error('Page not found')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('export default function')) throw new Error('Page component not found')
  })()

  await test('/knowledge/[id] page has upload dialog', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/[id]/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('Upload Documento')) throw new Error('Upload dialog not found')
  })()

  await test('/knowledge/[id] page has query/search dialog', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/[id]/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('Testar Busca')) throw new Error('Query dialog not found')
  })()

  await test('/knowledge/[id] page has reprocess action', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/[id]/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('handleReprocess')) throw new Error('Reprocess handler not found')
  })()

  await test('/knowledge/[id] page has preview dialog', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/knowledge/[id]/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    if (!content.includes('previewDoc')) throw new Error('Preview dialog not found')
  })()
}

// ========== TESTES FUNCIONAIS (COM DADOS) ==========

async function testFunctionalFlow() {
  log('info', '\n=== Testes Funcionais (com dados reais) ===\n')

  // Pegar um tenant existente para testes
  const tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null },
  })

  if (!tenant) {
    log('warn', 'Nenhum tenant encontrado - pulando testes funcionais')
    return
  }

  let testKbId: string | null = null
  let testDocId: string | null = null

  await test('CREATE: Criar knowledge base de teste', async () => {
    const kb = await prisma.knowledgeBase.create({
      data: {
        name: `Test KB ${Date.now()}`,
        description: 'Teste automatizado',
        tenantId: tenant.id,
        embeddingModel: 'text-embedding-3-small',
        chunkSize: 1000,
        chunkOverlap: 200,
      },
    })
    testKbId = kb.id
    if (!kb.id) throw new Error('KB not created')
  })()

  await test('READ: Listar knowledge bases do tenant', async () => {
    const kbs = await prisma.knowledgeBase.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
    })
    if (kbs.length === 0) throw new Error('No KBs found')
  })()

  await test('READ: Buscar knowledge base por ID', async () => {
    if (!testKbId) throw new Error('No test KB')
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: testKbId },
    })
    if (!kb) throw new Error('KB not found')
  })()

  await test('CREATE: Criar documento na knowledge base', async () => {
    if (!testKbId) throw new Error('No test KB')
    const doc = await prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: testKbId,
        title: 'Documento de Teste',
        content: 'Este é um conteúdo de teste para validar o sistema de knowledge base.',
        contentType: 'text/plain',
        status: 'PENDING',
      },
    })
    testDocId = doc.id
    if (!doc.id) throw new Error('Document not created')
  })()

  await test('READ: Listar documentos da knowledge base', async () => {
    if (!testKbId) throw new Error('No test KB')
    const docs = await prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId: testKbId, deletedAt: null },
    })
    if (docs.length === 0) throw new Error('No documents found')
  })()

  await test('UPDATE: Atualizar título do documento', async () => {
    if (!testDocId) throw new Error('No test doc')
    const doc = await prisma.knowledgeDocument.update({
      where: { id: testDocId },
      data: { title: 'Documento Atualizado' },
    })
    if (doc.title !== 'Documento Atualizado') throw new Error('Title not updated')
  })()

  await test('SEARCH: Buscar knowledge bases por nome', async () => {
    if (!testKbId) throw new Error('No test KB')
    const kbs = await prisma.knowledgeBase.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        name: { contains: 'Test KB', mode: 'insensitive' },
      },
    })
    if (kbs.length === 0) throw new Error('Search returned no results')
  })()

  await test('SEARCH: Buscar documentos por título', async () => {
    if (!testKbId) throw new Error('No test KB')
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBaseId: testKbId,
        deletedAt: null,
        title: { contains: 'Atualizado', mode: 'insensitive' },
      },
    })
    if (docs.length === 0) throw new Error('Search returned no results')
  })()

  // Cleanup
  await test('DELETE: Soft delete documento', async () => {
    if (!testDocId) throw new Error('No test doc')
    const doc = await prisma.knowledgeDocument.update({
      where: { id: testDocId },
      data: { deletedAt: new Date() },
    })
    if (!doc.deletedAt) throw new Error('Not soft deleted')
  })()

  await test('DELETE: Soft delete knowledge base', async () => {
    if (!testKbId) throw new Error('No test KB')
    const kb = await prisma.knowledgeBase.update({
      where: { id: testKbId },
      data: { deletedAt: new Date() },
    })
    if (!kb.deletedAt) throw new Error('Not soft deleted')
  })()
}

// ========== MAIN ==========

async function main() {
  console.log('\n' + '='.repeat(50))
  console.log('  KNOWLEDGE BASE TEST SUITE')
  console.log('='.repeat(50))

  try {
    await testDatabaseStructure()
    await testApiRoutes()
    await testKnowledgeLib()
    await testDashboardPages()
    await testFunctionalFlow()
  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('  RESUMO')
  console.log('='.repeat(50) + '\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`Total: ${results.length} testes`)
  console.log(`${colors.green}Passou: ${passed}${colors.reset}`)
  console.log(`${colors.red}Falhou: ${failed}${colors.reset}`)

  if (failed > 0) {
    console.log('\nFalhas:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.name}: ${r.error}`)
    })
  }

  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

main()
