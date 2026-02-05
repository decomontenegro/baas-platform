"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SkipLinkProps {
  /** ID of the main content element to skip to */
  targetId?: string
  /** Text to display in the skip link */
  children?: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Skip to content link for keyboard and screen reader users.
 * Should be the first focusable element on the page.
 * 
 * @example
 * ```tsx
 * // In your layout
 * <body>
 *   <SkipLink targetId="main-content" />
 *   <Header />
 *   <Sidebar />
 *   <main id="main-content">
 *     {children}
 *   </main>
 * </body>
 * ```
 */
export function SkipLink({
  targetId = "main-content",
  children = "Pular para o conteúdo principal",
  className,
}: SkipLinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      // Make target focusable if it isn't already
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1")
      }
      target.focus()
      // Scroll to target
      target.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Visually hidden by default
        "sr-only",
        // Becomes visible on focus
        "focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4",
        // Styling when visible
        "focus:block focus:px-4 focus:py-2",
        "focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-md focus:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "focus:font-medium focus:text-sm",
        className
      )}
    >
      {children}
    </a>
  )
}

/**
 * Multiple skip links for complex layouts.
 * 
 * @example
 * ```tsx
 * <SkipLinks
 *   links={[
 *     { targetId: "main-content", label: "Pular para o conteúdo" },
 *     { targetId: "main-nav", label: "Pular para a navegação" },
 *     { targetId: "search", label: "Pular para a busca" },
 *   ]}
 * />
 * ```
 */
interface SkipLinksProps {
  links: Array<{
    targetId: string
    label: string
  }>
  className?: string
}

export function SkipLinks({ links, className }: SkipLinksProps) {
  return (
    <nav
      aria-label="Links de navegação rápida"
      className={cn("sr-only focus-within:not-sr-only", className)}
    >
      <ul className="focus-within:fixed focus-within:z-[100] focus-within:top-4 focus-within:left-4 focus-within:flex focus-within:gap-2">
        {links.map(({ targetId, label }) => (
          <li key={targetId}>
            <SkipLink targetId={targetId}>{label}</SkipLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
