"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Smartphone, CheckCircle2, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface WhatsAppConnectProps {
  onConnect: () => void
  className?: string
}

type ConnectionStatus = "idle" | "loading" | "showing-qr" | "connected" | "error"

export function WhatsAppConnect({ onConnect, className }: WhatsAppConnectProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qrCode, setQrCode] = useState<string | null>(null) // Will be used for actual QR rendering
  const [countdown, setCountdown] = useState(120)

  // Simulate QR code generation (replace with actual Clawdbot API)
  const generateQRCode = async () => {
    setStatus("loading")
    
    // Simulated API call - replace with actual Clawdbot Gateway API
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    // Generate a placeholder QR code (in production, this comes from Clawdbot)
    const qrData = `whatsapp://connect?session=${Date.now()}`
    setQrCode(qrData)
    setStatus("showing-qr")
    setCountdown(120)
  }

  // QR Code expiration countdown
  useEffect(() => {
    if (status !== "showing-qr") return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus("idle")
          setQrCode(null)
          return 120
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [status])

  // Simulate connection polling (replace with actual API)
  useEffect(() => {
    if (status !== "showing-qr") return

    // In production, poll Clawdbot Gateway for connection status
    const pollInterval = setInterval(async () => {
      // Simulated: 10% chance per poll of "connecting"
      if (Math.random() > 0.9) {
        setStatus("connected")
        clearInterval(pollInterval)
        setTimeout(() => {
          onConnect()
        }, 1500)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [status, onConnect])

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted">
              <Smartphone className="h-16 w-16 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Conecte seu WhatsApp</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Escaneie o QR code com seu WhatsApp para conectar o bot à sua conta
              </p>
            </div>
            <Button onClick={generateQRCode} size="lg">
              Gerar QR Code
            </Button>
          </motion.div>
        )}

        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">
              Gerando QR Code...
            </p>
          </motion.div>
        )}

        {status === "showing-qr" && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center space-y-6"
          >
            {/* QR Code placeholder - replace with actual QR rendering */}
            <div className="relative p-4 bg-white rounded-2xl shadow-lg">
              <div className="w-48 h-48 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                {/* In production, render actual QR code here */}
                <div className="grid grid-cols-8 gap-0.5 p-4">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-4 h-4 rounded-sm",
                        Math.random() > 0.5 ? "bg-white" : "bg-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>
              <motion.div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Expira em {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </motion.div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Escaneie o QR Code</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Abra o WhatsApp → Menu ⋮ → Aparelhos conectados → Conectar um aparelho
              </p>
            </div>

            <Button variant="ghost" onClick={generateQRCode} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Gerar novo código
            </Button>
          </motion.div>
        )}

        {status === "connected" && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center space-y-6"
          >
            <motion.div
              className="flex h-32 w-32 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
            </motion.div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-green-600 dark:text-green-400">
                WhatsApp Conectado!
              </h3>
              <p className="text-sm text-muted-foreground">
                Sua conta foi conectada com sucesso
              </p>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-destructive/10">
              <Smartphone className="h-16 w-16 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-destructive">
                Erro na conexão
              </h3>
              <p className="text-sm text-muted-foreground">
                Não foi possível conectar. Tente novamente.
              </p>
            </div>
            <Button onClick={generateQRCode}>
              Tentar novamente
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
