import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * GET /api/status
 * 
 * Extended status endpoint with detailed system information
 * Different from /api/health - this provides operational insights
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    
    const status = {
      service: 'BaaS Dashboard',
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      memory: {
        usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      endpoints: {
        health: '/api/health',
        healthDetailed: '/api/health?detailed=true',
        analytics: '/api/analytics',
        governance: '/api/governance'
      }
    }
    
    if (format === 'text') {
      const text = [
        `🚀 ${status.service}`,
        `📊 Status: ${status.status.toUpperCase()}`,
        `⏰ Uptime: ${Math.floor(status.uptime / 60)}m ${status.uptime % 60}s`,
        `💾 Memory: ${status.memory.usage}MB / ${status.memory.total}MB`,
        `🔧 Version: ${status.version}`,
        `🌍 Environment: ${status.environment}`,
        `⚙️ Node.js: ${status.node}`,
        `💻 Platform: ${status.platform}`,
        '',
        '🔗 Endpoints:',
        `  • Health: ${status.endpoints.health}`,
        `  • Detailed: ${status.endpoints.healthDetailed}`,
        `  • Analytics: ${status.endpoints.analytics}`,
        `  • Governance: ${status.endpoints.governance}`,
      ].join('\n')
      
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0'
        }
      })
    }
    
    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
    
  } catch (error) {
    console.error('Status check failed:', error)
    
    return NextResponse.json({
      service: 'BaaS Dashboard',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  }
}