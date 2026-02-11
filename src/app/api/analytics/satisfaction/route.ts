import { NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/satisfaction
 * Returns satisfaction metrics and ratings
 */
export async function GET() {
  try {
    // Mock satisfaction data
    const satisfactionData = {
      overall: {
        score: 4.2,
        total: 156,
        distribution: {
          5: 89,  // 57%
          4: 34,  // 22% 
          3: 18,  // 12%
          2: 10,  // 6%
          1: 5    // 3%
        }
      },
      byChannel: [
        {
          channel: 'whatsapp',
          name: 'WhatsApp',
          score: 4.2,
          total: 156,
          trend: 'up'
        },
        {
          channel: 'webchat', 
          name: 'Web Chat',
          score: null,
          total: 0,
          trend: 'neutral'
        }
      ],
      trends: [
        { date: '2026-02-04', score: 4.1 },
        { date: '2026-02-05', score: 4.3 },
        { date: '2026-02-06', score: 4.0 },
        { date: '2026-02-07', score: 4.4 },
        { date: '2026-02-08', score: 4.2 },
        { date: '2026-02-09', score: 4.3 },
        { date: '2026-02-10', score: 4.2 }
      ],
      insights: {
        improvementAreas: [
          'Tempo de resposta durante picos',
          'Qualidade das respostas técnicas',
          'Cobertura de tópicos específicos'
        ],
        strengths: [
          'Disponibilidade 24/7',
          'Respostas rápidas',
          'Interface amigável'
        ]
      }
    }

    return NextResponse.json({
      success: true,
      data: satisfactionData
    })
  } catch (error) {
    console.error('Error fetching satisfaction analytics:', error)
    return NextResponse.json({ error: 'Erro ao buscar analytics de satisfação' }, { status: 500 })
  }
}