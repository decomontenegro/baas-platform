'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, Sparkles, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PersonalityRadar } from './PersonalitySliders'
import { BOT_TEMPLATES, type BotTemplate } from '@/types/bot'

interface BotTemplateSelectorProps {
  onSelect: (template: BotTemplate | null) => void
  selectedId?: string | null
  showFromScratch?: boolean
}

export function BotTemplateSelector({
  onSelect,
  selectedId,
  showFromScratch = true,
}: BotTemplateSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    green: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    orange: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    purple: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Escolha um template</h3>
      <p className="text-sm text-muted-foreground">
        Comece com um template pré-configurado ou crie do zero
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* From scratch option */}
        {showFromScratch && (
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(null)}
            className={cn(
              'relative cursor-pointer rounded-xl border-2 border-dashed p-4 transition-all',
              selectedId === null
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/20 hover:border-muted-foreground/40'
            )}
          >
            {selectedId === null && (
              <div className="absolute -top-2 -right-2">
                <div className="bg-primary text-primary-foreground rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Bot className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold">Começar do zero</h4>
                <p className="text-sm text-muted-foreground">
                  Crie um bot personalizado
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Templates */}
        {BOT_TEMPLATES.map((template) => (
          <motion.div
            key={template.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(template)}
            onMouseEnter={() => setHoveredId(template.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              'relative cursor-pointer rounded-xl border-2 p-4 transition-all',
              colorClasses[template.color] || 'bg-muted',
              selectedId === template.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-transparent hover:border-primary/30'
            )}
          >
            {selectedId === template.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2"
              >
                <div className="bg-primary text-primary-foreground rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              </motion.div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-background/80 flex items-center justify-center text-2xl shadow-sm">
                {template.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold">{template.name}</h4>
                <Badge variant="outline" className="mt-1 text-xs">
                  {template.department}
                </Badge>
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
              {template.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-3">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Hover preview */}
            <AnimatePresence>
              {hoveredId === template.id && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute right-2 bottom-2"
                >
                  <ChevronRight className="w-5 h-5 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Template detail preview
interface TemplatePreviewProps {
  template: BotTemplate
  className?: string
}

export function TemplatePreview({ template, className }: TemplatePreviewProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
          {template.icon}
        </div>
        <div>
          <h2 className="text-xl font-bold">{template.name}</h2>
          <Badge variant="outline">{template.department}</Badge>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground">{template.description}</p>

      {/* Personality Radar */}
      <div className="flex justify-center">
        <PersonalityRadar personality={template.personality} size={180} />
      </div>

      {/* Sample conversation */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Mensagem de boas-vindas</h3>
        <div className="p-3 bg-muted rounded-lg text-sm">
          {template.welcomeMessage}
        </div>
      </div>

      {/* Quick replies */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Respostas rápidas</h3>
        <div className="flex flex-wrap gap-2">
          {template.quickReplies.map((reply) => (
            <Badge key={reply} variant="secondary">
              {reply}
            </Badge>
          ))}
        </div>
      </div>

      {/* Handoff triggers */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Palavras para transferência</h3>
        <div className="flex flex-wrap gap-2">
          {template.handoffTriggers.map((trigger) => (
            <Badge key={trigger} variant="outline">
              {trigger}
            </Badge>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {template.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
