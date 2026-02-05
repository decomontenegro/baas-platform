import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import type { TestBotInput, TestBotResponse, BotPersonality } from '@/types/bot'

interface RouteParams {
  params: { id: string }
}

/**
 * Build system prompt with personality modifiers
 */
function buildSystemPromptWithPersonality(
  basePrompt: string,
  personality: BotPersonality
): string {
  const modifiers: string[] = []

  // Creativity
  if (personality.creativity < 30) {
    modifiers.push('Seja factual e direto nas respostas.')
  } else if (personality.creativity > 70) {
    modifiers.push('Seja criativo e use analogias interessantes.')
  }

  // Formality
  if (personality.formality < 30) {
    modifiers.push('Use uma linguagem casual e descontraída.')
  } else if (personality.formality > 70) {
    modifiers.push('Mantenha um tom formal e profissional.')
  }

  // Verbosity
  if (personality.verbosity < 30) {
    modifiers.push('Seja conciso e objetivo nas respostas.')
  } else if (personality.verbosity > 70) {
    modifiers.push('Forneça respostas detalhadas e completas.')
  }

  // Empathy
  if (personality.empathy > 70) {
    modifiers.push('Demonstre empatia e compreensão com o usuário.')
  }

  // Humor
  if (personality.humor > 70) {
    modifiers.push('Inclua um toque de humor quando apropriado.')
  } else if (personality.humor < 30) {
    modifiers.push('Mantenha um tom sério e profissional.')
  }

  if (modifiers.length > 0) {
    return `${basePrompt}\n\nDiretrizes de personalidade:\n${modifiers.map(m => `- ${m}`).join('\n')}`
  }

  return basePrompt
}

/**
 * POST /api/bots/[id]/test
 * Test a bot with a message
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id: botId } = params
    const body: TestBotInput = await request.json()

    // Validate input
    if (!body.message?.trim()) {
      return errorResponse('Mensagem é obrigatória')
    }

    // Get bot
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        tenantId,
        deletedAt: null,
      },
      include: {
        knowledgeBase: {
          select: { id: true, name: true },
        },
      },
    })

    if (!bot) {
      return errorResponse('Bot não encontrado', 404)
    }

    const personality = bot.personality as BotPersonality
    const systemPrompt = buildSystemPromptWithPersonality(bot.systemPrompt, personality)

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Add context if provided
    if (body.context && body.context.length > 0) {
      messages.push({
        role: 'system',
        content: `Contexto adicional:\n${body.context.join('\n')}`,
      })
    }

    // Add conversation history if provided
    if (body.conversationHistory && body.conversationHistory.length > 0) {
      for (const msg of body.conversationHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    // Add user message
    messages.push({ role: 'user', content: body.message.trim() })

    // Call AI model
    const startTime = Date.now()

    // Check if OpenAI or Anthropic based on model
    let response: string
    let tokensUsed = { input: 0, output: 0, total: 0 }

    if (bot.model.startsWith('claude')) {
      // Anthropic API call
      const anthropicResponse = await callAnthropic(messages, bot)
      response = anthropicResponse.content
      tokensUsed = anthropicResponse.tokensUsed
    } else {
      // OpenAI API call (default)
      const openaiResponse = await callOpenAI(messages, bot)
      response = openaiResponse.content
      tokensUsed = openaiResponse.tokensUsed
    }

    const latencyMs = Date.now() - startTime

    const result: TestBotResponse = {
      response,
      tokensUsed,
      latencyMs,
      model: bot.model,
    }

    return successResponse(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error testing bot:', error)
    return errorResponse('Erro ao testar bot', 500)
  }
}

// OpenAI API call
async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  bot: { model: string; temperature: number; maxTokens: number }
): Promise<{ content: string; tokensUsed: { input: number; output: number; total: number } }> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    // Return mock response for development
    return {
      content: mockResponse(messages[messages.length - 1].content),
      tokensUsed: { input: 50, output: 100, total: 150 },
    }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: bot.model,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      temperature: bot.temperature,
      max_tokens: bot.maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API error:', error)
    throw new Error('Erro ao chamar API do OpenAI')
  }

  const data = await response.json()

  return {
    content: data.choices[0].message.content,
    tokensUsed: {
      input: data.usage.prompt_tokens,
      output: data.usage.completion_tokens,
      total: data.usage.total_tokens,
    },
  }
}

// Anthropic API call
async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  bot: { model: string; temperature: number; maxTokens: number }
): Promise<{ content: string; tokensUsed: { input: number; output: number; total: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    // Return mock response for development
    return {
      content: mockResponse(messages[messages.length - 1].content),
      tokensUsed: { input: 50, output: 100, total: 150 },
    }
  }

  // Extract system message
  const systemMessage = messages.find(m => m.role === 'system')?.content || ''
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: bot.model,
      system: systemMessage,
      messages: conversationMessages,
      temperature: bot.temperature,
      max_tokens: bot.maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Anthropic API error:', error)
    throw new Error('Erro ao chamar API do Anthropic')
  }

  const data = await response.json()

  return {
    content: data.content[0].text,
    tokensUsed: {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      total: data.usage.input_tokens + data.usage.output_tokens,
    },
  }
}

// Mock response for development without API keys
function mockResponse(userMessage: string): string {
  const responses = [
    `Entendi sua mensagem: "${userMessage}". Como posso ajudá-lo mais?`,
    `Obrigado por entrar em contato! Sobre "${userMessage}", posso fornecer mais informações.`,
    `Vou verificar isso para você. A respeito de "${userMessage}", aqui estão algumas opções...`,
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}
