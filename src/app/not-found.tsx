import { Search, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-blue-600" />
          </div>
          
          <CardTitle className="text-2xl">Página não encontrada</CardTitle>
          <p className="text-muted-foreground mt-2">
            A página que você está procurando não existe ou foi movida.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-6xl font-bold text-gray-300 mb-4">
            404
          </div>
          
          <div className="flex flex-col gap-3">
            <Link href="/dashboard">
              <Button className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Ir para Dashboard
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
          
          <div className="mt-6">
            <p className="text-xs text-muted-foreground">
              Precisa de ajuda? Entre em contato com o suporte.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}