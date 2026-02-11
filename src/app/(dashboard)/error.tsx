'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Log dashboard-specific error
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle>Erro no Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Não foi possível carregar os dados do dashboard. 
            Verifique sua conexão e tente novamente.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-xs font-mono text-orange-800 break-all">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar
            </Button>
            
            <Link href="/analytics" className="flex-1">
              <Button className="w-full">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </Link>
          </div>
          
          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Problema persistindo? Verifique o status dos serviços.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}