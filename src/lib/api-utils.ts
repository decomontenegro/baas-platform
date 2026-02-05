import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { ApiResponse, PaginatedResponse } from '@/types/api'

// Standard API response helpers
export function successResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  })
}

export function errorResponse(
  error: string,
  status: number = 400
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  )
}

export function paginatedResponse<T>(
  data: T[],
  pagination: PaginatedResponse<T>['pagination']
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    pagination,
  })
}

// Parse query params helpers
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

export function getDateRangeParams(searchParams: URLSearchParams) {
  const now = new Date()
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

  const startStr = searchParams.get('start')
  const endStr = searchParams.get('end')

  const start = startStr ? new Date(startStr) : defaultStart
  const end = endStr ? new Date(endStr) : now

  return { start, end }
}

// Auth helper - get user ID from NextAuth session
export async function getOrganizationId(_request: Request): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }
  return session.user.id
}

export async function requireAuth(_request: Request): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

// Generate IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}${random}`
}
