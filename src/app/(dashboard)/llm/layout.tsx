"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gauge, Plug, Bell, Cog, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface TabItem {
  title: string
  href: string
  icon: React.ElementType
}

const tabs: TabItem[] = [
  { title: "Consumo", href: "/llm", icon: Gauge },
  { title: "Providers", href: "/llm/providers", icon: Plug },
  { title: "Alertas", href: "/llm/alerts", icon: Bell },
  { title: "Configurações", href: "/llm/settings", icon: Cog },
]

export default function LLMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Check if path matches (exact for /llm, startsWith for others)
  const isActive = (href: string) => {
    if (href === "/llm") {
      return pathname === "/llm"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 text-sm text-muted-foreground border-b bg-muted/30">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">LLM Gateway</span>
        {pathname !== "/llm" && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">
              {tabs.find(t => isActive(t.href) && t.href !== "/llm")?.title || ""}
            </span>
          </>
        )}
      </div>

      {/* Sub-navigation tabs */}
      <div className="border-b bg-background">
        <nav className="flex gap-1 px-6 pt-2" role="tablist" aria-label="LLM Gateway navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={active}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors",
                  "border-b-2 -mb-[2px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-primary text-primary bg-muted/50"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.title}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
