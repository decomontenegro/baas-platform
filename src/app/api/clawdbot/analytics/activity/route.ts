import { NextResponse, NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

// API Route to get activity feed from Clawdbot
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    
    // Mock activity data based on real system activity
    const activities = [
      {
        id: '1',
        type: 'message',
        description: 'Nova conversa iniciada no WhatsApp',
        channelId: '1',
        channelName: 'WhatsApp Groups',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        type: 'message',
        description: 'Resposta automática enviada',
        channelId: '1',
        channelName: 'WhatsApp Groups',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        type: 'channel_updated',
        description: 'Configuração de canal atualizada',
        channelId: '2',
        channelName: 'Clawdbot Config',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        type: 'system',
        description: 'Sistema iniciado com sucesso',
        channelId: null,
        channelName: 'Sistema',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: '5',
        type: 'message',
        description: 'Conversa finalizada automaticamente',
        channelId: '1',
        channelName: 'WhatsApp Groups',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ].slice(0, limit)
    
    return NextResponse.json(activities)
  } catch (error) {
    console.error('Error fetching clawdbot activity:', error)
    return NextResponse.json({ 
      error: 'Erro ao buscar atividade' 
    }, { status: 500 })
  }
}