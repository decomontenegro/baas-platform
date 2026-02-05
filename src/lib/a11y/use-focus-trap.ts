"use client"

import * as React from "react"

interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  enabled?: boolean
  /** Element to return focus to when trap is deactivated */
  returnFocusTo?: HTMLElement | null
  /** Initial element to focus when trap is activated */
  initialFocus?: HTMLElement | null
  /** Allow focus to escape to elements with this selector */
  allowOutsideClick?: boolean
}

/**
 * Hook to trap focus within a container element.
 * Essential for modals, dialogs, and other overlay components.
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const containerRef = useFocusTrap<HTMLDivElement>({
 *     enabled: isOpen,
 *   });
 *   
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       ...
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: UseFocusTrapOptions = {}
): React.RefObject<T> {
  const { enabled = true, returnFocusTo, initialFocus, allowOutsideClick = false } = options
  const containerRef = React.useRef<T>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!enabled) return

    // Store the currently focused element to return focus later
    previousActiveElement.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const focusableSelector = [
        'a[href]:not([disabled]):not([tabindex="-1"])',
        'button:not([disabled]):not([tabindex="-1"])',
        'input:not([disabled]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([tabindex="-1"])',
        'select:not([disabled]):not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"]):not([disabled])',
        '[contenteditable="true"]:not([disabled])',
      ].join(", ")

      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((el) => {
          // Filter out elements that are not visible
          const style = window.getComputedStyle(el)
          return style.display !== "none" && style.visibility !== "hidden"
        })
    }

    // Focus the initial element or the first focusable element
    const focusInitial = () => {
      const focusable = getFocusableElements()
      if (initialFocus && focusable.includes(initialFocus)) {
        initialFocus.focus()
      } else if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        // If no focusable elements, focus the container itself
        container.setAttribute("tabindex", "-1")
        container.focus()
      }
    }

    // Handle tab key to trap focus
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return

      const focusable = getFocusableElements()
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]

      if (event.shiftKey) {
        // Shift + Tab: move focus backward
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: move focus forward
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    // Handle focus events to keep focus inside container
    const handleFocusIn = (event: FocusEvent) => {
      if (allowOutsideClick) return
      
      const target = event.target as HTMLElement
      if (!container.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
        const focusable = getFocusableElements()
        if (focusable.length > 0) {
          focusable[0].focus()
        }
      }
    }

    // Set up event listeners
    container.addEventListener("keydown", handleKeyDown)
    document.addEventListener("focusin", handleFocusIn)

    // Focus initial element
    focusInitial()

    return () => {
      container.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("focusin", handleFocusIn)

      // Return focus to the previously focused element
      const elementToFocus = returnFocusTo || previousActiveElement.current
      if (elementToFocus && typeof elementToFocus.focus === "function") {
        // Use setTimeout to ensure focus happens after the component unmounts
        setTimeout(() => {
          elementToFocus.focus()
        }, 0)
      }
    }
  }, [enabled, returnFocusTo, initialFocus, allowOutsideClick])

  return containerRef
}

/**
 * Get the first and last focusable elements in a container.
 * Useful for manual focus management.
 */
export function getFocusBoundaries(container: HTMLElement): {
  first: HTMLElement | null
  last: HTMLElement | null
} {
  const focusableSelector = [
    'a[href]:not([disabled]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(", ")

  const elements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((el) => {
      const style = window.getComputedStyle(el)
      return style.display !== "none" && style.visibility !== "hidden"
    })

  return {
    first: elements[0] || null,
    last: elements[elements.length - 1] || null,
  }
}
