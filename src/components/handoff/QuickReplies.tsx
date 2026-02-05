'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Save,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface QuickReply {
  id: string
  label: string
  message: string
  shortcut?: string
}

interface QuickRepliesProps {
  replies: QuickReply[]
  onSelect: (message: string) => void
  onAdd?: (reply: Omit<QuickReply, 'id'>) => void
  onEdit?: (id: string, reply: Partial<QuickReply>) => void
  onDelete?: (id: string) => void
  editable?: boolean
}

// Default quick replies
const defaultReplies: QuickReply[] = [
  {
    id: '1',
    label: 'Olá',
    message: 'Olá! Sou um atendente humano. Como posso ajudá-lo?',
    shortcut: 'Ctrl+1',
  },
  {
    id: '2',
    label: 'Aguarde',
    message: 'Por favor, aguarde um momento enquanto verifico essa informação para você.',
    shortcut: 'Ctrl+2',
  },
  {
    id: '3',
    label: 'Obrigado',
    message: 'Obrigado pelo contato! Posso ajudar em algo mais?',
    shortcut: 'Ctrl+3',
  },
  {
    id: '4',
    label: 'Transferir',
    message: 'Vou transferir você para um especialista que pode ajudar melhor com essa questão.',
    shortcut: 'Ctrl+4',
  },
  {
    id: '5',
    label: 'Encerrar',
    message: 'Foi um prazer atendê-lo! Se precisar de mais ajuda, estamos à disposição.',
    shortcut: 'Ctrl+5',
  },
]

export function QuickReplies({
  replies = defaultReplies,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  editable = false,
}: QuickRepliesProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editingReply, setEditingReply] = React.useState<QuickReply | null>(null)
  const [newReply, setNewReply] = React.useState({ label: '', message: '' })

  const handleSaveEdit = () => {
    if (editingReply && onEdit) {
      onEdit(editingReply.id, editingReply)
      setEditingReply(null)
    }
  }

  const handleAddNew = () => {
    if (newReply.label && newReply.message && onAdd) {
      onAdd(newReply)
      setNewReply({ label: '', message: '' })
    }
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= replies.length) {
          e.preventDefault()
          onSelect(replies[num - 1].message)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [replies, onSelect])

  return (
    <div className="border-t bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4" />
          <span>Respostas rápidas</span>
        </div>
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <>
                <X className="h-4 w-4 mr-1" />
                Fechar
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4 mr-1" />
                Editar
              </>
            )}
          </Button>
        )}
      </div>

      {/* Quick Reply Buttons */}
      <div className="p-2 flex flex-wrap gap-2">
        {replies.map((reply, index) => (
          <motion.div
            key={reply.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative group"
          >
            {isEditing ? (
              <div className="flex items-center gap-1 bg-card border rounded-lg px-3 py-2">
                {onEdit && (
                  <button
                    onClick={() => setEditingReply(reply)}
                    className="p-1 hover:bg-muted rounded"
                    aria-label="Editar"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
                <span className="text-sm">{reply.label}</span>
                {onDelete && (
                  <button
                    onClick={() => onDelete(reply.id)}
                    className="p-1 hover:bg-destructive/10 rounded text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect(reply.message)}
                className="relative"
                title={reply.message}
              >
                {reply.label}
                {reply.shortcut && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {reply.shortcut.replace('Ctrl', '⌘')}
                  </span>
                )}
              </Button>
            )}
          </motion.div>
        ))}

        {/* Add New Button (when editing) */}
        {isEditing && onAdd && (
          <Button
            variant="dashed"
            size="sm"
            onClick={() => setEditingReply({ id: 'new', label: '', message: '' })}
            className="border-dashed"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Edit Modal */}
      {editingReply && (
        <div className="p-4 border-t bg-card">
          <h4 className="text-sm font-medium mb-3">
            {editingReply.id === 'new' ? 'Nova resposta rápida' : 'Editar resposta'}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Rótulo
              </label>
              <input
                type="text"
                value={editingReply.label}
                onChange={(e) =>
                  setEditingReply({ ...editingReply, label: e.target.value })
                }
                placeholder="Ex: Saudação"
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Mensagem
              </label>
              <textarea
                value={editingReply.message}
                onChange={(e) =>
                  setEditingReply({ ...editingReply, message: e.target.value })
                }
                placeholder="Digite a mensagem completa..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingReply(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (editingReply.id === 'new') {
                    onAdd?.({
                      label: editingReply.label,
                      message: editingReply.message,
                    })
                  } else {
                    onEdit?.(editingReply.id, editingReply)
                  }
                  setEditingReply(null)
                }}
                disabled={!editingReply.label || !editingReply.message}
              >
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickReplies
