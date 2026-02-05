import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import { personalityTemplates, customPersonalities } from '@/lib/mock-data'
import type { Personality, PersonalityPreviewInput, PersonalityPreviewResponse } from '@/types/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Helper to find personality by ID
function findPersonality(id: string, orgId: string): Personality | null {
  const template = personalityTemplates.find((p) => p.id === id)
  if (template) return template

  const custom = customPersonalities.get(id)
  if (custom && custom.organizationId === orgId) return custom

  return null
}

// Mock response generation based on personality
function generateMockResponse(personality: Personality, message: string): string {
  const toneResponses: Record<string, string[]> = {
    professional: [
      'Obrigado por entrar em contato. Analisei sua solicitação e posso ajudá-lo da seguinte forma:',
      'Com base na sua mensagem, preparei uma resposta detalhada:',
      'Agradeço sua pergunta. Segue a orientação solicitada:',
    ],
    friendly: [
      'Opa! Que legal que você perguntou isso! Olha só:',
      'Oi! Posso te ajudar com isso, sim! Veja:',
      'E aí! Boa pergunta! Deixa eu te explicar:',
    ],
    casual: [
      'Blz! Então, funciona assim:',
      'Tranquilo! É o seguinte:',
      'Entendi! Olha só como é:',
    ],
    formal: [
      'Prezado(a), em resposta à sua solicitação, informamos:',
      'Vossa Senhoria, conforme requisitado, esclarecemos que:',
      'Em atenção ao seu questionamento, segue nossa resposta:',
    ],
    technical: [
      'Conforme a documentação técnica, o processo é o seguinte:',
      'Tecnicamente, a solução envolve os seguintes passos:',
      'A implementação requer os seguintes procedimentos:',
    ],
  }

  const responses = toneResponses[personality.tone] || toneResponses.professional
  const opener = responses[Math.floor(Math.random() * responses.length)]

  // Generate a contextual response based on the message
  const contextualResponse = `
${opener}

Com base na sua mensagem "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}", posso fornecer as seguintes informações:

1. **Análise**: Identifiquei os pontos principais da sua solicitação.
2. **Solução**: Preparei uma resposta alinhada com o perfil "${personality.name}".
3. **Próximos passos**: Posso detalhar qualquer aspecto que precisar.

---
*Esta é uma resposta simulada gerada com a personality "${personality.name}" (tom: ${personality.tone}).*
`.trim()

  return contextualResponse
}

/**
 * POST /api/personalities/[id]/preview
 * Simula uma resposta do bot usando esta personality
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const orgId = await requireAuth(request)
    const { id } = await params
    const body: PersonalityPreviewInput = await request.json()

    // Validate input
    if (!body.message?.trim()) {
      return errorResponse('Mensagem é obrigatória')
    }

    const personality = findPersonality(id, orgId)
    if (!personality) {
      return errorResponse('Personality não encontrada', 404)
    }

    const startTime = Date.now()

    // In production, this would call the actual AI with the personality's system prompt
    // For now, generate a mock response
    const response = generateMockResponse(personality, body.message)

    const latencyMs = Date.now() - startTime + Math.floor(Math.random() * 500) // Simulate some latency
    const tokensUsed = Math.floor(response.length / 4) + Math.floor(body.message.length / 4)

    const previewResponse: PersonalityPreviewResponse = {
      response,
      personality: {
        id: personality.id,
        name: personality.name,
        tone: personality.tone,
      },
      tokensUsed,
      latencyMs,
    }

    return successResponse(previewResponse)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error in personality preview:', error)
    return errorResponse('Erro ao gerar preview', 500)
  }
}
