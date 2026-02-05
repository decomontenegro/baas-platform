'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Save, 
  RotateCcw, 
  Send,
  Bot,
  User,
  Sparkles,
  Check
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Slider } from '@/components/ui/slider'
import { mockTemplates, mockPersonality } from '@/hooks/use-personality'
import { cn } from '@/lib/utils'
import type { Personality, PersonalityTemplate } from '@/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const samplePrompts = [
  "Hello, can you help me?",
  "What's the weather like today?",
  "Tell me a joke",
  "Explain quantum computing",
  "I'm feeling stressed today",
]

export default function BehaviorPage() {
  const [personality, setPersonality] = useState<Partial<Personality>>(mockPersonality)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Chat sandbox state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: 'Hello! How can I help you today?' }
  ])
  const [isTyping, setIsTyping] = useState(false)

  const handleTemplateSelect = (template: PersonalityTemplate) => {
    setSelectedTemplate(template.id)
    setPersonality({
      ...personality,
      systemPrompt: template.systemPrompt,
      ...template.defaults,
    })
  }

  const handleSliderChange = (key: keyof Personality, value: number) => {
    setPersonality({ ...personality, [key]: value })
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setPersonality(mockPersonality)
    setSelectedTemplate(null)
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsTyping(true)
    
    // Simulate AI response based on personality
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const responses = [
      `I understand you're asking about "${chatInput}". Let me help you with that.`,
      `That's an interesting question! Based on my understanding...`,
      `Great question! Here's what I think...`,
    ]
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)],
    }
    
    setIsTyping(false)
    setChatMessages(prev => [...prev, assistantMessage])
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title="Behavior" subtitle="Customize your bot's personality and responses" />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            {/* Template Picker */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Start with a preset personality or customize from scratch
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mockTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      selectedTemplate === template.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-[var(--border)] hover:border-primary-300 hover:bg-[var(--muted)]'
                    )}
                  >
                    <span className="text-2xl block mb-2">{template.icon}</span>
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1 line-clamp-2">
                      {template.description}
                    </p>
                    {selectedTemplate === template.id && (
                      <div className="mt-2 flex items-center text-xs text-primary-600">
                        <Check className="w-3 h-3 mr-1" />
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Personality Sliders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Fine-tune Personality</h3>
              <div className="space-y-6">
                <Slider
                  label="Creativity"
                  description="How creative and imaginative the responses are"
                  value={personality.creativity || 50}
                  onChange={(v) => handleSliderChange('creativity', v)}
                  leftLabel="Conservative"
                  rightLabel="Creative"
                  color="purple"
                />
                <Slider
                  label="Formality"
                  description="The level of professionalism in responses"
                  value={personality.formality || 50}
                  onChange={(v) => handleSliderChange('formality', v)}
                  leftLabel="Casual"
                  rightLabel="Formal"
                  color="blue"
                />
                <Slider
                  label="Verbosity"
                  description="How detailed and lengthy responses are"
                  value={personality.verbosity || 50}
                  onChange={(v) => handleSliderChange('verbosity', v)}
                  leftLabel="Concise"
                  rightLabel="Detailed"
                  color="green"
                />
                <Slider
                  label="Empathy"
                  description="How emotionally understanding the bot is"
                  value={personality.empathy || 50}
                  onChange={(v) => handleSliderChange('empathy', v)}
                  leftLabel="Neutral"
                  rightLabel="Empathetic"
                  color="orange"
                />
                <Slider
                  label="Humor"
                  description="How much humor and playfulness to include"
                  value={personality.humor || 50}
                  onChange={(v) => handleSliderChange('humor', v)}
                  leftLabel="Serious"
                  rightLabel="Playful"
                  color="purple"
                />
              </div>
            </motion.div>

            {/* System Prompt Editor */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">System Prompt</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Customize the core instructions that define your bot's behavior
              </p>
              <textarea
                value={personality.systemPrompt || ''}
                onChange={(e) => setPersonality({ ...personality, systemPrompt: e.target.value })}
                rows={6}
                className="input resize-none font-mono text-sm"
                placeholder="You are a helpful AI assistant..."
              />
            </motion.div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Right Column - Sandbox Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card flex flex-col h-[calc(100vh-12rem)] sticky top-6"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Sandbox Preview</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">Test your bot's personality</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <AnimatePresence>
                {chatMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
                      message.role === 'user' 
                        ? 'bg-[var(--muted)]' 
                        : 'bg-gradient-to-br from-primary-500 to-accent-500'
                    )}>
                      {message.role === 'user' 
                        ? <User className="w-4 h-4" /> 
                        : <Bot className="w-4 h-4 text-white" />
                      }
                    </div>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2',
                      message.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-[var(--muted)] rounded-bl-sm'
                    )}>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[var(--muted)] rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="w-2 h-2 bg-gray-400 rounded-full"
                      />
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                        className="w-2 h-2 bg-gray-400 rounded-full"
                      />
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                        className="w-2 h-2 bg-gray-400 rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick prompts */}
            <div className="px-4 pb-2">
              <p className="text-xs text-[var(--muted-foreground)] mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {samplePrompts.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setChatInput(prompt)}
                    className="text-xs px-3 py-1 bg-[var(--muted)] rounded-full hover:bg-[var(--border)] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-[var(--border)]">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message to test..."
                  className="input flex-1"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isTyping}
                  className="btn-primary px-4"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
