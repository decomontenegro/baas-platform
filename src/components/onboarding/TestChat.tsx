"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Bot, User, Loader2, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { PersonalityType } from "@/hooks/use-onboarding"

interface Message {
  id: string
  content: string
  role: "user" | "bot"
  timestamp: Date
}

const personalityResponses: Record<NonNullable<PersonalityType>, string[]> = {
  friendly: [
    "Oi! 👋 Que legal falar com você! Como posso ajudar?",
    "Claro! 😊 Deixa comigo, vou resolver isso rapidinho!",
    "Entendi! Olha só que bacana, posso te ajudar com isso sim! 🎉",
  ],
  professional: [
    "Olá. Como posso auxiliá-lo hoje?",
    "Compreendido. Vou processar sua solicitação.",
    "Certamente. Segue a informação solicitada.",
  ],
  casual: [
    "E aí! 😎 Manda aí que a gente resolve!",
    "Show! Já tô ligado no que precisa! ✌️",
    "Beleza! Deixa que eu dou um jeito nisso pra você!",
  ],
  formal: [
    "Prezado(a), em que posso ser útil?",
    "Compreendo perfeitamente. Permita-me auxiliá-lo.",
    "Agradeço o contato. Estou à disposição para atendê-lo.",
  ],
}

interface TestChatProps {
  personality: PersonalityType
  onTestComplete: () => void
  className?: string
}

export function TestChat({ personality, onTestComplete, className }: TestChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [hasTestedOnce, setHasTestedOnce] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Add initial bot greeting on mount
  useEffect(() => {
    if (personality && messages.length === 0) {
      const responses = personalityResponses[personality] || personalityResponses.friendly
      const greeting = responses[0]
      
      setTimeout(() => {
        setMessages([
          {
            id: "initial",
            content: greeting,
            role: "bot",
            timestamp: new Date(),
          },
        ])
      }, 500)
    }
  }, [personality, messages.length])

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Simulate bot response
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

    const responses = personality
      ? personalityResponses[personality]
      : personalityResponses.friendly
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]

    const botMessage: Message = {
      id: `bot-${Date.now()}`,
      content: randomResponse,
      role: "bot",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, botMessage])
    setIsTyping(false)
    setHasTestedOnce(true)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={cn("flex flex-col h-[400px] max-w-md mx-auto", className)}>
      <div className="text-center space-y-2 mb-4">
        <h3 className="text-lg font-medium">Teste o bot</h3>
        <p className="text-sm text-muted-foreground">
          Envie uma mensagem para ver como o bot responde
        </p>
      </div>

      {/* Chat container */}
      <div className="flex-1 flex flex-col rounded-xl border bg-muted/30 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex items-end gap-2",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "bot" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-background border rounded-bl-sm"
                  )}
                >
                  {message.content}
                  {message.role === "user" && (
                    <CheckCheck className="inline-block ml-2 h-3 w-3 text-primary-foreground/60" />
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-end gap-2"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-background border rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <motion.span
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    />
                    <motion.span
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.span
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-3 bg-background">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              disabled={isTyping}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              size="icon"
              aria-label="Enviar mensagem"
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Continue button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: hasTestedOnce ? 1 : 0.5 }}
        className="mt-4 text-center"
      >
        <Button
          onClick={onTestComplete}
          disabled={!hasTestedOnce}
          className="w-full sm:w-auto"
        >
          {hasTestedOnce ? "Continuar" : "Envie uma mensagem para continuar"}
        </Button>
      </motion.div>
    </div>
  )
}
