/**
 * Accessibility utilities and hooks for the BaaS Dashboard
 * 
 * This module provides reusable accessibility patterns following WAI-ARIA guidelines.
 */

export { useFocusTrap, getFocusBoundaries } from "./use-focus-trap"
export { useKeyboardNav, useRovingTabIndex } from "./use-keyboard-nav"

/**
 * Announce a message to screen readers using aria-live regions
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite"): void {
  // Check if we already have an announcer
  let announcer = document.getElementById(`a11y-announcer-${priority}`)

  if (!announcer) {
    announcer = document.createElement("div")
    announcer.id = `a11y-announcer-${priority}`
    announcer.setAttribute("role", "status")
    announcer.setAttribute("aria-live", priority)
    announcer.setAttribute("aria-atomic", "true")
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `
    document.body.appendChild(announcer)
  }

  // Clear and set new message (timing needed for screen readers to pick up change)
  announcer.textContent = ""
  setTimeout(() => {
    announcer!.textContent = message
  }, 100)
}

/**
 * Check if an element is visible (not hidden by CSS)
 */
export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  )
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (!isVisible(element)) return false
  if (element.hasAttribute("disabled")) return false
  if (element.getAttribute("aria-disabled") === "true") return false

  const tabIndex = element.tabIndex
  if (tabIndex < 0) return false

  // Check for naturally focusable elements
  const focusableTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]
  if (focusableTags.includes(element.tagName)) {
    if (element.tagName === "A" && !element.hasAttribute("href")) {
      return false
    }
    return true
  }

  // Check for tabindex
  return element.hasAttribute("tabindex")
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]:not([disabled]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
    '[contenteditable="true"]:not([disabled])',
  ].join(", ")

  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .filter(isVisible)
    .filter(isFocusable)
}

/**
 * Utility to generate unique IDs for ARIA relationships
 */
let idCounter = 0
export function generateId(prefix = "a11y"): string {
  return `${prefix}-${++idCounter}`
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(prefers-contrast: more)").matches ||
    window.matchMedia("(forced-colors: active)").matches
  )
}

/**
 * Skip link component props generator
 */
export function getSkipLinkProps(targetId: string) {
  return {
    href: `#${targetId}`,
    className: "sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground",
    children: "Pular para o conteúdo principal",
  }
}
