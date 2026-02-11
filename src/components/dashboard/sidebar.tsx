"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Bot,
  Brain,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  CreditCard,
  Headphones,
  Home,
  Key,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  Settings,
  Users,
  Webhook,
  Workflow,
  Shield,
  Gauge,
  Plug,
  Bell,
  Cog,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "Conversas", href: "/dashboard/conversations", icon: MessageSquare,  },
      { title: "Handoff", href: "/handoff", icon: Headphones },
    ],
  },
  {
    title: "Engajamento",
    items: [
      { title: "Agendamentos", href: "/scheduled", icon: Calendar },
      { title: "Campanhas", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    title: "Configuração",
    items: [
      { title: "Bots", href: "/bots", icon: Bot },
      { title: "Admin Agent", href: "/admin", icon: Shield },
      { title: "Templates", href: "/templates", icon: LayoutTemplate },
      { title: "Knowledge Base", href: "/knowledge", icon: Brain },
      { title: "Fluxos", href: "/dashboard/flows", icon: Workflow },
      { title: "Canais", href: "/channels", icon: Webhook },
    ],
  },
  {
    title: "LLM Gateway",
    items: [
      { title: "Consumo", href: "/llm", icon: Gauge },
      { title: "Providers", href: "/llm/providers", icon: Plug },
      { title: "Alertas", href: "/llm/alerts", icon: Bell },
      { title: "Configurações", href: "/llm/settings", icon: Cog },
    ],
  },
  {
    title: "Equipe",
    items: [
      { title: "Membros", href: "/team", icon: Users },
      { title: "API Keys", href: "/api-keys", icon: Key },
    ],
  },
  {
    title: "Administração",
    items: [
      { title: "Métricas", href: "/admin/metrics", icon: BarChart3 },
      { title: "Credenciais", href: "/admin/credentials", icon: Key },
      { title: "LLM Providers", href: "/llm/providers", icon: Gauge },
    ],
  },
  {
    title: "Conta",
    items: [
      { title: "Faturamento", href: "/billing", icon: CreditCard },
      { title: "Configurações", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

const tenants = [
  { id: "1", name: "BaaS Dashboard", plan: "Pro" },
  { id: "2", name: "Startup Beta", plan: "Free" },
  { id: "3", name: "Corp Gamma", plan: "Enterprise" },
]

interface SidebarProps {
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
  className?: string
}

export function Sidebar({ collapsed = false, onCollapse, className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentTenant, setCurrentTenant] = React.useState(tenants[0])
  const [focusedGroupIndex, setFocusedGroupIndex] = React.useState<number | null>(null)
  const [focusedItemIndex, setFocusedItemIndex] = React.useState<number>(0)
  const navRef = React.useRef<HTMLDivElement>(null)

  // Handle logout for simple auth
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/simple', { 
        method: 'DELETE',
        credentials: 'include'
      })
      router.push('/simple-login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback - still redirect to login
      router.push('/simple-login')
    }
  }

  // Flatten all items for keyboard navigation
  const allItems = React.useMemo(() => {
    return navigation.flatMap((group, groupIndex) =>
      group.items.map((item, itemIndex) => ({
        ...item,
        groupIndex,
        itemIndex,
      }))
    )
  }, [])

  // Find the current active item index
  const activeItemIndex = React.useMemo(() => {
    return allItems.findIndex((item) => pathname === item.href)
  }, [allItems, pathname])

  // Keyboard navigation handler
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      const itemCount = allItems.length

      switch (event.key) {
        case "ArrowUp": {
          event.preventDefault()
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemCount - 1
          const nextItem = navRef.current?.querySelector(
            `[data-nav-index="${prevIndex}"]`
          ) as HTMLElement
          nextItem?.focus()
          break
        }
        case "ArrowDown": {
          event.preventDefault()
          const nextIndex = currentIndex < itemCount - 1 ? currentIndex + 1 : 0
          const nextItem = navRef.current?.querySelector(
            `[data-nav-index="${nextIndex}"]`
          ) as HTMLElement
          nextItem?.focus()
          break
        }
        case "Home": {
          event.preventDefault()
          const firstItem = navRef.current?.querySelector(
            '[data-nav-index="0"]'
          ) as HTMLElement
          firstItem?.focus()
          break
        }
        case "End": {
          event.preventDefault()
          const lastItem = navRef.current?.querySelector(
            `[data-nav-index="${itemCount - 1}"]`
          ) as HTMLElement
          lastItem?.focus()
          break
        }
      }
    },
    [allItems.length]
  )

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
        className
      )}
      aria-label="Navegação principal"
    >
      {/* Header with Tenant Switcher */}
      <div className="flex items-center h-[var(--header-height)] px-4 border-b">
        {collapsed ? (
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-full"
            aria-label="Selecionar organização"
          >
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-2"
                aria-label={`Organização atual: ${currentTenant.name}. Clique para trocar`}
                aria-haspopup="listbox"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div 
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                    aria-hidden="true"
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="truncate text-sm font-medium">
                      {currentTenant.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {currentTenant.plan}
                    </span>
                  </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]" role="listbox">
              <DropdownMenuLabel>Organizações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => setCurrentTenant(tenant)}
                  className="cursor-pointer"
                  role="option"
                  aria-selected={currentTenant.id === tenant.id}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="flex h-6 w-6 items-center justify-center rounded bg-muted"
                      aria-hidden="true"
                    >
                      <Building2 className="h-3 w-3" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm">{tenant.name}</span>
                      <span className="text-xs text-muted-foreground">{tenant.plan}</span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Nova Organização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Navigation */}
      <nav 
        ref={navRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-2"
        role="navigation"
        aria-label="Menu do dashboard"
      >
        {navigation.map((group, groupIndex) => (
          <div key={group.title} className="mb-4" role="group" aria-labelledby={`nav-group-${groupIndex}`}>
            {!collapsed && (
              <h3 
                id={`nav-group-${groupIndex}`}
                className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {group.title}
              </h3>
            )}
            <ul className="space-y-1" role="list">
              {group.items.map((item, itemIndex) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                const globalIndex = allItems.findIndex(
                  (i) => i.groupIndex === groupIndex && i.itemIndex === itemIndex
                )
                
                return (
                  <li key={item.href} role="listitem">
                    <Link
                      href={item.href}
                      data-nav-index={globalIndex}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        collapsed && "justify-center px-2"
                      )}
                      title={collapsed ? item.title : undefined}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={collapsed ? item.title : undefined}
                      onKeyDown={(e) => handleKeyDown(e, globalIndex)}
                      tabIndex={globalIndex === activeItemIndex || (activeItemIndex === -1 && globalIndex === 0) ? 0 : -1}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          {item.badge && (
                            <span 
                              className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/20 px-1.5 text-xs font-medium text-primary"
                              aria-label={`${item.badge} notificações`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Menu */}
      <div className="border-t p-2">
        {collapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-full"
                aria-label="Menu do usuário: Usuário"
              >
                <div 
                  className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" 
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>Usuário</span>
                  <span className="text-xs text-muted-foreground">seu@email.com</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start px-2"
                aria-label="Menu do usuário: Usuário, seu@email.com"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" 
                    aria-hidden="true"
                  />
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="truncate text-sm font-medium">Usuário</span>
                    <span className="truncate text-xs text-muted-foreground">
                      seu@email.com
                    </span>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => onCollapse?.(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
            aria-hidden="true"
          />
          {!collapsed && <span className="ml-2">Recolher</span>}
        </Button>
      </div>
    </aside>
  )
}
