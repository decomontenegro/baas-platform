'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  RotateCcw,
  Bot,
  User,
  Loader2,
  Info,
  Clock,
  Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bot as BotType, TestBotResponse } from '@/types/bot'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    latencyMs?: number
    tokensUsed?: number
    model?: string
  }
}

interface BotTestChatProps {
  bot: BotType
  className?: string
}

export function BotTestChat({ bot, className }: BotTestChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Add welcome message on mount
  useEffect(() => {
    if (bot.welcomeMessage && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: bot.welcomeMessage,
          timestamp: new Date(),
        },
      ])
    }
  }, [bot.welcomeMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      // Build conversation history
      const conversationHistory = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      const response = await fetch(`/api/bots/${bot.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao testar bot')
      }

      const result: TestBotResponse = data.data

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        metadata: {
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed.total,
          model: result.model,
        },
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleReset = () => {
    const welcomeMsg = bot.welcomeMessage
      ? [
          {
            id: 'welcome',
            role: 'assistant' as const,
            content: bot.welcomeMessage,
            timestamp: new Date(),
          },
        ]
      : []
    setMessages(welcomeMsg)
    setError(null)
  }

  const handleQuickReply = (reply: string) => {
    setInput(reply)
    inputRef.current?.focus()
  }

  return (
    <div className={cn('flex flex-col h-full bg-background rounded-xl border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
            {bot.avatar || <Bot className="w-4 h-4 text-primary" />}
          </div>
          <div>
            <p className="font-medium text-sm">{bot.name}</p>
            <p className="text-xs text-muted-foreground">Modo de teste</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Reiniciar conversa"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <span className="text-lg">{bot.avatar || '🤖'}</span>
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Metadata */}
                {message.metadata && (
                  <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                    {message.metadata.latencyMs && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {message.metadata.latencyMs}ms
                      </span>
                    )}
                    {message.metadata.tokensUsed && (
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {message.metadata.tokensUsed} tokens
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg">
              {bot.avatar || '🤖'}
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Digitando...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
          >
            <Info className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {bot.quickReplies.length > 0 && messages.length <= 1 && (
        <div className="px-4 py-2 border-t">
          <div className="flex flex-wrap gap-2">
            {bot.quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleQuickReply(reply)}
                className="px-3 py-1.5 text-xs bg-muted rounded-full hover:bg-muted/80 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-background border rounded-full text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-2.5 rounded-full transition-colors',
              input.trim() && !isLoading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
