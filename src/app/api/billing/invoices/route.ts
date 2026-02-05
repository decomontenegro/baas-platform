import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { getInvoices } from '@/lib/billing/stripe'

/**
 * GET /api/billing/invoices
 * Returns invoice history
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '10')

    const invoices = await getInvoices(tenantId, limit)

    // Format invoices for response
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount,
      formattedAmount: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: invoice.currency,
      }).format(invoice.amount),
      currency: invoice.currency,
      status: invoice.status,
      statusLabel: getStatusLabel(invoice.status),
      paidAt: invoice.paidAt,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      period: formatPeriod(invoice.periodStart, invoice.periodEnd),
      invoiceUrl: invoice.invoiceUrl,
      canDownload: !!invoice.invoiceUrl,
    }))

    return successResponse({
      invoices: formattedInvoices,
      total: invoices.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching invoices:', error)
    return errorResponse('Erro ao buscar faturas', 500)
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Rascunho',
    PENDING: 'Pendente',
    PAID: 'Pago',
    FAILED: 'Falhou',
    REFUNDED: 'Reembolsado',
    CANCELLED: 'Cancelado',
  }
  return labels[status] || status
}

function formatPeriod(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
  return formatter.format(start)
}
