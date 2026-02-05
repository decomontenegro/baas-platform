'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/a11y'

interface ModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Title displayed in the modal header */
  title: string
  /** Optional description for the modal */
  description?: string
  /** Content to render inside the modal */
  children: React.ReactNode
  /** Additional CSS classes for the modal content */
  className?: string
  /** ID for the modal title (for aria-labelledby) */
  titleId?: string
  /** ID for the modal description (for aria-describedby) */
  descriptionId?: string
  /** Whether to show the close button */
  showCloseButton?: boolean
  /** Callback when the modal is closed via close button or ESC */
  onClose?: () => void
}

/**
 * Accessible Modal component with focus trap, ESC key handling,
 * and proper ARIA attributes.
 * 
 * @example
 * ```tsx
 * function Example() {
 *   const [open, setOpen] = useState(false);
 *   
 *   return (
 *     <>
 *       <Button onClick={() => setOpen(true)}>Open Modal</Button>
 *       <Modal
 *         open={open}
 *         onOpenChange={setOpen}
 *         title="Confirm Action"
 *         description="Are you sure you want to proceed?"
 *       >
 *         <div className="flex gap-2">
 *           <Button onClick={() => setOpen(false)}>Cancel</Button>
 *           <Button variant="destructive">Confirm</Button>
 *         </div>
 *       </Modal>
 *     </>
 *   );
 * }
 * ```
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  titleId: customTitleId,
  descriptionId: customDescriptionId,
  showCloseButton = true,
  onClose,
}: ModalProps) {
  const generatedTitleId = React.useId()
  const generatedDescriptionId = React.useId()
  const titleId = customTitleId || `modal-title-${generatedTitleId}`
  const descriptionId = customDescriptionId || `modal-desc-${generatedDescriptionId}`
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // Store the element that triggered the modal
  React.useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
    }
  }, [open])

  // Handle close and return focus
  const handleClose = React.useCallback(() => {
    onOpenChange(false)
    onClose?.()
    
    // Return focus to the element that opened the modal
    if (previousActiveElement.current) {
      setTimeout(() => {
        previousActiveElement.current?.focus()
      }, 0)
    }
  }, [onOpenChange, onClose])

  // Handle ESC key
  const handleEscapeKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    },
    [handleClose]
  )

  React.useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscapeKeyDown)
      return () => {
        document.removeEventListener('keydown', handleEscapeKeyDown)
      }
    }
  }, [open, handleEscapeKeyDown])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                aria-hidden="true"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
                  'w-full max-w-lg max-h-[85vh] overflow-auto',
                  'card p-6',
                  'focus:outline-none',
                  className
                )}
                role="dialog"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Dialog.Title 
                      id={titleId}
                      className="text-lg font-semibold"
                    >
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description 
                        id={descriptionId}
                        className="text-sm text-[var(--muted-foreground)] mt-1"
                      >
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  {showCloseButton && (
                    <Dialog.Close asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label="Fechar modal"
                        onClick={handleClose}
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </Dialog.Close>
                  )}
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/**
 * Modal with built-in focus trap using our custom hook.
 * Use when you need more control over focus management.
 */
interface ManagedModalProps extends Omit<ModalProps, 'open' | 'onOpenChange'> {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when the modal should close */
  onClose: () => void
  /** Initial element to focus when modal opens */
  initialFocusRef?: React.RefObject<HTMLElement>
  /** Element to return focus to when modal closes */
  returnFocusRef?: React.RefObject<HTMLElement>
}

export function ManagedModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  titleId: customTitleId,
  descriptionId: customDescriptionId,
  showCloseButton = true,
  initialFocusRef,
  returnFocusRef,
}: ManagedModalProps) {
  const generatedTitleId = React.useId()
  const generatedDescriptionId = React.useId()
  const titleId = customTitleId || `modal-title-${generatedTitleId}`
  const descriptionId = customDescriptionId || `modal-desc-${generatedDescriptionId}`
  
  const containerRef = useFocusTrap<HTMLDivElement>({
    enabled: isOpen,
    returnFocusTo: returnFocusRef?.current,
    initialFocus: initialFocusRef?.current,
  })

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg max-h-[85vh] overflow-auto',
          'bg-card rounded-lg border shadow-lg p-6',
          'focus:outline-none',
          className
        )}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Fechar modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
