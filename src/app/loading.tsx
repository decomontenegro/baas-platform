import { Loader2 } from 'lucide-react'

export default function LoadingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Carregando</h2>
          <p className="text-sm text-muted-foreground">
            Preparando sua dashboard...
          </p>
        </div>
      </div>
    </div>
  )
}