/**
 * Emergency Access Module
 * 
 * Tracks and manages backup access methods
 * Ensures admins can always reach the system
 */

import { prisma } from '@/lib/prisma'

export interface AccessPoint {
  type: 'cloudflare' | 'tailscale' | 'direct' | 'ttyd'
  name: string
  url: string
  status: 'online' | 'offline' | 'unknown'
  lastCheck: Date | null
  isPrimary: boolean
  isEmergency: boolean
}

export interface EmergencyAccessConfig {
  primaryUrl: string
  tailscaleUrl?: string
  ttydPort?: number
  alertOnPrimaryDown: boolean
  alertContacts: string[]
}

/**
 * Check if a URL is accessible
 */
async function checkUrl(url: string, timeoutMs: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    return response.ok || response.status === 307 // 307 = redirect to login (valid)
  } catch {
    return false
  }
}

/**
 * Get all configured access points for a tenant
 */
export async function getAccessPoints(tenantId: string): Promise<AccessPoint[]> {
  // For now, return hardcoded access points based on typical BaaS setup
  // In production, this would read from tenant config
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app-url.com'
  
  const points: AccessPoint[] = [
    {
      type: 'cloudflare',
      name: 'Cloudflare Tunnel',
      url: baseUrl,
      status: 'unknown',
      lastCheck: null,
      isPrimary: true,
      isEmergency: false
    }
  ]
  
  // Add Tailscale if configured
  if (process.env.TAILSCALE_URL) {
    points.push({
      type: 'tailscale',
      name: 'Tailscale (Emergência)',
      url: process.env.TAILSCALE_URL,
      status: 'unknown',
      lastCheck: null,
      isPrimary: false,
      isEmergency: true
    })
  }
  
  // Add ttyd if configured
  if (process.env.TTYD_PORT) {
    points.push({
      type: 'ttyd',
      name: 'Terminal Web (ttyd)',
      url: `${process.env.TAILSCALE_URL || 'http://localhost'}:${process.env.TTYD_PORT}`,
      status: 'unknown',
      lastCheck: null,
      isPrimary: false,
      isEmergency: true
    })
  }
  
  return points
}

/**
 * Check status of all access points
 */
export async function checkAllAccessPoints(tenantId: string): Promise<AccessPoint[]> {
  const points = await getAccessPoints(tenantId)
  const now = new Date()
  
  const checkedPoints = await Promise.all(
    points.map(async (point) => {
      const isOnline = await checkUrl(point.url)
      return {
        ...point,
        status: isOnline ? 'online' : 'offline',
        lastCheck: now
      } as AccessPoint
    })
  )
  
  return checkedPoints
}

/**
 * Check if emergency access is needed (primary down)
 */
export async function isEmergencyAccessNeeded(tenantId: string): Promise<{
  needed: boolean
  primaryDown: boolean
  emergencyAvailable: boolean
  availablePoints: AccessPoint[]
}> {
  const points = await checkAllAccessPoints(tenantId)
  
  const primary = points.find(p => p.isPrimary)
  const emergency = points.filter(p => p.isEmergency && p.status === 'online')
  
  const primaryDown = primary?.status === 'offline'
  const emergencyAvailable = emergency.length > 0
  
  return {
    needed: primaryDown,
    primaryDown,
    emergencyAvailable,
    availablePoints: points.filter(p => p.status === 'online')
  }
}

/**
 * Generate emergency access instructions
 */
export function getEmergencyInstructions(availablePoints: AccessPoint[]): string {
  if (availablePoints.length === 0) {
    return `
⚠️ ACESSO DE EMERGÊNCIA INDISPONÍVEL

Todos os pontos de acesso estão offline.
Ações recomendadas:
1. Verificar conexão de internet do servidor
2. Verificar se o serviço está rodando (SSH direto)
3. Verificar status no painel DigitalOcean/cloud provider
4. Contatar suporte técnico
    `.trim()
  }
  
  const lines = ['🔐 ACESSO DE EMERGÊNCIA DISPONÍVEL\n']
  
  for (const point of availablePoints) {
    if (point.isEmergency) {
      lines.push(`✅ ${point.name}: ${point.url}`)
    }
  }
  
  lines.push('\nInstruções:')
  lines.push('1. Acesse um dos URLs acima')
  lines.push('2. Faça login com suas credenciais')
  lines.push('3. Verifique logs e status do sistema')
  
  return lines.join('\n')
}

/**
 * Log emergency access attempt
 */
export async function logEmergencyAccess(
  tenantId: string,
  userId: string,
  accessPoint: string,
  success: boolean
): Promise<void> {
  // In production, this would log to a security audit table
  console.log(`[EMERGENCY ACCESS] tenant=${tenantId} user=${userId} point=${accessPoint} success=${success}`)
  
  // Could also create an AdminAlert for auditing
  const adminAgent = await prisma.adminAgent.findUnique({
    where: { tenantId }
  })
  
  if (adminAgent) {
    await prisma.adminAlert.create({
      data: {
        adminAgentId: adminAgent.id,
        type: 'SECURITY_ALERT',
        severity: 'INFO',
        title: 'Acesso de emergência',
        message: `Usuário acessou via ${accessPoint}. Sucesso: ${success}`,
        metadata: { userId, accessPoint, success, timestamp: new Date().toISOString() }
      }
    })
  }
}
