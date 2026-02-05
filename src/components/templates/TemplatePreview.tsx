'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  User,
  Send,
  MessageSquare,
  Brain,
  Zap,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Template, TemplateExampleMessage } from '@/types/templates'

interface TemplatePreviewProps {
  template: Template
  className?: string
  autoPlay?: boolean
}

const personalityLabels: Record<string, { left: string; right: string; icon: any }> = {
  creativity: { left: 'Conservador', right: 'Criativo', icon: Brain },
  formality: { left: 'Casual', right: 'Formal', icon: Shield },
  verbosity: { left: 'Conciso', right: 'Detalhado', icon: MessageSquare },
  empathy: { left: 'Neutro', right: 'Empático', icon: Zap },
  humor: { left: 'Sério', right: 'Divertido', icon: Bot },
}

export function TemplatePreview({
  template,
  className,
  autoPlay = false,
}: TemplatePreviewProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(
    autoPlay ? 0 : template.config.exampleConversations.length
  )
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const visibleMessages = template.config.exampleConversations.slice(
    0,
    currentMessageIndex
  )

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    // Simulate typing
    setIsTyping(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsTyping(false)

    setInputValue('')
  }

  const handleShowNext = () => {
    if (currentMessageIndex < template.config.exampleConversations.length) {
      setCurrentMessageIndex((prev) => prev + 1)
    }
  }

  const handleReplay = () => {
    setCurrentMessageIndex(0)
    // Auto-play messages
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        if (prev >= template.config.exampleConversations.length) {
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 1500)
  }

  return (
    <div className={cn('flex flex-col h-full bg-card rounded-xl border', className)}>
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl">
          {template.icon}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold">{template.name}</h4>
          <p className="text-xs text-muted-foreground">Preview do template</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex-shrink-0 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="max-w-[85%] bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
            <p className="text-sm">{template.config.welcomeMessage}</p>
          </div>
        </motion.div>

        {/* Example Conversation */}
        <AnimatePresence>
          {visibleMessages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.1 }}
              className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
                  message.role === 'user'
                    ? 'bg-muted'
                    : 'bg-gradient-to-br from-primary to-primary/60'
                )}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                )}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-2 h-2 bg-muted-foreground/40 rounded-full"
                />
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-2 h-2 bg-muted-foreground/40 rounded-full"
                />
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-2 h-2 bg-muted-foreground/40 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Show More / Replay Buttons */}
        {currentMessageIndex < template.config.exampleConversations.length ? (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleShowNext}
            className="mx-auto flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver próxima mensagem
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        ) : (
          visibleMessages.length > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleReplay}
              className="mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              🔄 Replay conversa
            </motion.button>
          )
        )}
      </div>

      {/* Quick Replies */}
      {template.config.quickReplies.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {template.config.quickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => setInputValue(reply)}
                className="text-xs px-3 py-1.5 bg-muted rounded-full hover:bg-muted/80 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

// Personality Bars Component
export function PersonalityBars({ template }: { template: Template }) {
  const { personality } = template.config

  return (
    <div className="space-y-4">
      {Object.entries(personality).map(([key, value]) => {
        const config = personalityLabels[key]
        if (!config) return null
        const Icon = config.icon

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="capitalize">{key}</span>
              </div>
              <span className="text-muted-foreground">{value}%</span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/60 rounded-full"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{config.left}</span>
              <span>{config.right}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
