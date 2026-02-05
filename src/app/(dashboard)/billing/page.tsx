'use client'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Bot,
  Users,
  HardDrive,
  Zap,
  Crown,
  ExternalLink,
  Download,
  ArrowUpRight,
  Clock,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface BillingData {
  plan: {
    id: string
    name: string
    price: number
    features: string[]
  }
  subscription: {
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    daysRemaining: number
  }
  limits: {
    maxChannels: number
    maxMessages: number
    maxBots: number
    maxUsers: number
    maxStorage: number
    hasAnalytics: boolean
    hasApiAccess: boolean
    hasPrioritySupport: boolean
    hasCustomBranding: boolean
  }
  usage: {
    messages: { used: number; limit: number; percentage: number }
    channels: { used: number; limit: number; percentage: number }
    bots: { used: number; limit: number; percentage: number }
    users: { used: number; limit: number; percentage: number }
    storage: { used: number; limit: number; percentage: number }
  }
  warnings: string[]
}

interface Invoice {
  id: string
  amount: number
  formattedAmount: string
  status: string
  statusLabel: string
  paidAt: string | null
  period: string
  invoiceUrl: string | null
}

interface Plan {
  id: string
  name: string
  description: string
  price: number
  formattedPrice: string
  features: string[]
  popular: boolean
  isCurrent: boolean
  isUpgrade: boolean
  isDowngrade: boolean
  limits: {
    maxChannels: number
    maxMessages: number
    maxBots: number
    maxUsers: number
    maxStorage: number
  }
}

function BillingContent() {
  const searchParams = useSearchParams()
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)

  // Check for success/cancel from Stripe redirect
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    fetchBillingData()
  }, [])

  async function fetchBillingData() {
    try {
      const [billingRes, invoicesRes, plansRes] = await Promise.all([
        fetch('/api/billing'),
        fetch('/api/billing/invoices'),
        fetch('/api/billing/upgrade'),
      ])

      if (billingRes.ok) {
        const data = await billingRes.json()
        setBilling(data.data)
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setInvoices(data.data?.invoices ?? [])
      }

      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data.data?.plans ?? [])
      }
    } catch (error) {
      console.error('Error fetching billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(planId: string) {
    setUpgrading(true)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })

      const data = await res.json()

      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl
      } else if (data.data?.requiresContact) {
        alert(data.data.message)
      }
    } catch (error) {
      console.error('Error upgrading:', error)
    } finally {
      setUpgrading(false)
    }
  }

  async function handleOpenPortal() {
    setOpeningPortal(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.data?.portalUrl) {
        window.location.href = data.data.portalUrl
      }
    } catch (error) {
      console.error('Error opening portal:', error)
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Success/Cancel alerts */}
      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Pagamento confirmado!</AlertTitle>
          <AlertDescription>
            Seu plano foi atualizado com sucesso. As novas funcionalidades já estão disponíveis.
          </AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Pagamento cancelado</AlertTitle>
          <AlertDescription>
            O processo de pagamento foi cancelado. Você pode tentar novamente quando quiser.
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {billing?.warnings && billing.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside">
              {billing.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Billing & Uso</h1>
          <p className="text-muted-foreground">
            Gerencie sua assinatura e acompanhe o uso da plataforma
          </p>
        </div>
        <Button onClick={handleOpenPortal} disabled={openingPortal} variant="outline">
          <ExternalLink className="mr-2 h-4 w-4" />
          {openingPortal ? 'Abrindo...' : 'Portal de Pagamentos'}
        </Button>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Plano {billing?.plan.name}
            </CardTitle>
            <CardDescription>
              {billing?.plan.price === 0
                ? 'Plano gratuito'
                : `R$ ${billing?.plan.price}/mês`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={billing?.subscription.status === 'ACTIVE' ? 'default' : 'destructive'}>
              {billing?.subscription.status === 'ACTIVE' ? 'Ativo' : billing?.subscription.status}
            </Badge>
            {billing?.subscription.cancelAtPeriodEnd && (
              <Badge variant="outline" className="text-orange-600">
                Cancela em {billing?.subscription.daysRemaining} dias
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {billing?.subscription.daysRemaining} dias restantes no período
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <UsageCard
          title="Mensagens"
          icon={<MessageSquare className="h-4 w-4" />}
          used={billing?.usage.messages.used ?? 0}
          limit={billing?.usage.messages.limit ?? 0}
          percentage={billing?.usage.messages.percentage ?? 0}
          unit="msgs"
        />
        <UsageCard
          title="Grupos"
          icon={<Zap className="h-4 w-4" />}
          used={billing?.usage.channels.used ?? 0}
          limit={billing?.usage.channels.limit ?? 0}
          percentage={billing?.usage.channels.percentage ?? 0}
          unit="grupos"
        />
        <UsageCard
          title="Bots"
          icon={<Bot className="h-4 w-4" />}
          used={billing?.usage.bots.used ?? 0}
          limit={billing?.usage.bots.limit ?? 0}
          percentage={billing?.usage.bots.percentage ?? 0}
          unit="bots"
        />
        <UsageCard
          title="Membros"
          icon={<Users className="h-4 w-4" />}
          used={billing?.usage.users.used ?? 0}
          limit={billing?.usage.users.limit ?? 0}
          percentage={billing?.usage.users.percentage ?? 0}
          unit="membros"
        />
        <UsageCard
          title="Storage"
          icon={<HardDrive className="h-4 w-4" />}
          used={billing?.usage.storage.used ?? 0}
          limit={billing?.usage.storage.limit ?? 0}
          percentage={billing?.usage.storage.percentage ?? 0}
          unit="MB"
        />
      </div>

      {/* Tabs for Plans and Invoices */}
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="invoices">Faturas</TabsTrigger>
          <TabsTrigger value="features">Recursos do Plano</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular ? 'border-primary shadow-lg' : ''
                } ${plan.isCurrent ? 'ring-2 ring-primary' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Mais Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {plan.isCurrent && <Badge variant="outline">Atual</Badge>}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">{plan.formattedPrice}</div>

                  <ul className="space-y-2 text-sm">
                    {(plan.features ?? []).slice(0, 5).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {!plan.isCurrent && (
                    <Button
                      className="w-full"
                      variant={plan.isUpgrade ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading || plan.id === 'ENTERPRISE'}
                    >
                      {upgrading ? (
                        'Processando...'
                      ) : plan.id === 'ENTERPRISE' ? (
                        'Fale Conosco'
                      ) : plan.isUpgrade ? (
                        <>
                          Fazer Upgrade <ArrowUpRight className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        'Mudar para este plano'
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Faturas</CardTitle>
              <CardDescription>Suas faturas e pagamentos anteriores</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma fatura encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.period}</TableCell>
                        <TableCell>{invoice.formattedAmount}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === 'PAID'
                                ? 'default'
                                : invoice.status === 'PENDING'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {invoice.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.paidAt
                            ? new Date(invoice.paidAt).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoice.invoiceUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.invoiceUrl!, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Recursos do seu Plano</CardTitle>
              <CardDescription>
                Funcionalidades incluídas no plano {billing?.plan.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureItem
                  name="Analytics Avançado"
                  included={billing?.limits.hasAnalytics ?? false}
                />
                <FeatureItem
                  name="Acesso à API"
                  included={billing?.limits.hasApiAccess ?? false}
                />
                <FeatureItem
                  name="Suporte Prioritário"
                  included={billing?.limits.hasPrioritySupport ?? false}
                />
                <FeatureItem
                  name="White-label / Branding"
                  included={billing?.limits.hasCustomBranding ?? false}
                />
              </div>

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold mb-4">Limites do Plano</h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <LimitItem
                    label="Grupos"
                    value={billing?.limits.maxChannels ?? 0}
                  />
                  <LimitItem
                    label="Mensagens/mês"
                    value={billing?.limits.maxMessages ?? 0}
                  />
                  <LimitItem label="Bots" value={billing?.limits.maxBots ?? 0} />
                  <LimitItem
                    label="Membros"
                    value={billing?.limits.maxUsers ?? 0}
                  />
                  <LimitItem
                    label="Storage (MB)"
                    value={billing?.limits.maxStorage ?? 0}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BillingFallback() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingContent />
    </Suspense>
  )
}

// Usage Card Component
function UsageCard({
  title,
  icon,
  used,
  limit,
  percentage,
  unit,
}: {
  title: string
  icon: React.ReactNode
  used: number
  limit: number
  percentage: number
  unit: string
}) {
  const isUnlimited = limit === -1
  const isWarning = percentage >= 80 && percentage < 100
  const isDanger = percentage >= 100

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {used.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground">
            {' '}
            / {isUnlimited ? '∞' : limit.toLocaleString()} {unit}
          </span>
        </div>
        {!isUnlimited && (
          <Progress
            value={Math.min(percentage, 100)}
            className={`mt-2 ${
              isDanger
                ? '[&>div]:bg-red-500'
                : isWarning
                ? '[&>div]:bg-yellow-500'
                : ''
            }`}
          />
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {isUnlimited ? 'Ilimitado' : `${percentage}% utilizado`}
        </p>
      </CardContent>
    </Card>
  )
}

// Feature Item Component
function FeatureItem({ name, included }: { name: string; included: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {included ? (
        <Check className="h-5 w-5 text-green-500" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground" />
      )}
      <span className={included ? '' : 'text-muted-foreground'}>{name}</span>
    </div>
  )
}

// Limit Item Component
function LimitItem({ label, value }: { label: string; value: number }) {
  const isUnlimited = value === -1
  return (
    <div className="text-center p-4 bg-muted rounded-lg">
      <div className="text-2xl font-bold">
        {isUnlimited ? '∞' : value.toLocaleString()}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}
