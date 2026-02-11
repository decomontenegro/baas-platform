"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Key, Smartphone } from "lucide-react"
import Link from "next/link"

export default function WhatsAppAPIKeysPage() {
  const [qrCode, setQrCode] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<'idle' | 'generating' | 'waiting' | 'connected'>('idle')

  const generateQR = async () => {
    setStatus('generating')
    try {
      const response = await fetch('/api/clawdbot/whatsapp/link')
      const data = await response.json()
      
      if (data.success) {
        // Mock QR for now - in real implementation, would get actual QR
        setQrCode('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')
        setStatus('waiting')
      }
    } catch (error) {
      console.error('Error generating QR:', error)
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link href="/setup" className="flex items-center text-blue-600 hover:text-blue-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Setup Wizard
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Smartphone className="w-8 h-8 text-blue-600" />
            <Key className="w-6 h-6 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Connection</h1>
          <p className="text-gray-600 mt-2">Connect your WhatsApp to start receiving messages</p>
        </div>

        {/* Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === 'idle' && (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Click the button below to generate a QR code for WhatsApp connection.
                </p>
                <Button onClick={generateQR} className="w-full">
                  Generate QR Code
                </Button>
              </div>
            )}

            {status === 'generating' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating QR code...</p>
              </div>
            )}

            {status === 'waiting' && qrCode && (
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg border mx-auto w-fit mb-4">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">Scan with WhatsApp</p>
                  <p className="text-sm text-gray-600">
                    1. Open WhatsApp on your phone<br/>
                    2. Go to Menu → Linked Devices<br/>
                    3. Tap "Link a Device"<br/>
                    4. Scan this QR code
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setStatus('idle')}
                  className="mt-4"
                >
                  Generate New QR
                </Button>
              </div>
            )}

            {status === 'connected' && (
              <div className="text-center">
                <div className="text-green-600 text-5xl mb-4">✅</div>
                <h3 className="text-lg font-semibold text-green-600 mb-2">Connected!</h3>
                <p className="text-gray-600">Your WhatsApp is now connected and ready to receive messages.</p>
              </div>
            )}

            {/* Navigation */}
            <div className="pt-4 border-t flex justify-between">
              <Link href="/setup">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Setup
                </Button>
              </Link>
              
              <Link href="/setup/llm">
                <Button disabled={status !== 'connected'}>
                  Next: Configure LLM
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Status Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Connection status: {status}
          </p>
        </div>
      </div>
    </div>
  )
}