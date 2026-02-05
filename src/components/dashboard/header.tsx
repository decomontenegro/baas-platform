"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  ChevronRight,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { announce } from "@/lib/a11y"

const breadcrumbMap: Record<string, string> = {
  dashboard: "Dashboard",
  conversations: "Conversas",
  bots: "Bots",
  flows: "Fluxos",
  channels: "Canais",
  members: "Membros",
  "api-keys": "API Keys",
  billing: "Faturamento",
  settings: "Configurações",
}

interface Notification {
  id: string
  title: string
  description: string
  time: string
  read: boolean
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    title: "Nova conversa",
    description: "Cliente iniciou uma conversa pelo WhatsApp",
    time: "2 min atrás",
    read: false,
  },
  {
    id: "2",
    title: "Limite de mensagens",
    description: "Você atingiu 80% do limite mensal",
    time: "1 hora atrás",
    read: false,
  },
  {
    id: "3",
    title: "Bot atualizado",
    description: "Assistente de Vendas foi republicado com sucesso",
    time: "3 horas atrás",
    read: true,
  },
]

interface HeaderProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
  className?: string
}

export function Header({ onMenuClick, showMenuButton = false, className }: HeaderProps) {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [isDark, setIsDark] = React.useState(false)
  const [notifications, setNotifications] = React.useState(mockNotifications)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Generate breadcrumbs from pathname
  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    return segments.map((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/")
      const label = breadcrumbMap[segment] || segment
      return { href, label }
    })
  }, [pathname])

  // Announce new notifications to screen readers
  React.useEffect(() => {
    const newUnread = notifications.filter((n) => !n.read)
    if (newUnread.length > 0) {
      // Only announce if component is already mounted (not on initial render)
      const timer = setTimeout(() => {
        // This would be called when new notifications arrive
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [notifications])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    announce("Notificação marcada como lida")
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    announce("Todas as notificações marcadas como lidas")
  }

  // Focus search input when opened
  React.useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  // Handle escape key to close search
  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setSearchOpen(false)
    }
  }

  return (
    <header
      className={cn(
        "flex items-center h-[var(--header-height)] px-4 border-b bg-card",
        className
      )}
      role="banner"
    >
      {/* Mobile menu button */}
      {showMenuButton && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 lg:hidden"
          onClick={onMenuClick}
          aria-label="Abrir menu de navegação"
          aria-expanded={false}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}

      {/* Breadcrumbs */}
      <nav 
        className="hidden sm:flex items-center space-x-1 text-sm"
        aria-label="Navegação por migalhas de pão"
      >
        <ol className="flex items-center space-x-1" role="list">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight 
                  className="h-4 w-4 text-muted-foreground mx-1" 
                  aria-hidden="true"
                />
              )}
              {index === breadcrumbs.length - 1 ? (
                <span 
                  className="font-medium text-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative mr-2" role="search">
        {searchOpen ? (
          <div className="flex items-center">
            <label htmlFor="header-search" className="sr-only">
              Buscar no dashboard
            </label>
            <Input
              ref={searchInputRef}
              id="header-search"
              type="search"
              placeholder="Buscar..."
              className="w-64"
              onKeyDown={handleSearchKeyDown}
              aria-label="Buscar no dashboard"
            />
            <Button
              variant="ghost"
              size="icon"
              className="ml-1"
              onClick={() => setSearchOpen(false)}
              aria-label="Fechar busca"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label="Abrir busca"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="mr-2"
        onClick={() => {
          setIsDark(!isDark)
          announce(isDark ? "Tema claro ativado" : "Tema escuro ativado")
        }}
        aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
        aria-pressed={isDark}
      >
        {isDark ? (
          <Sun className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5" aria-hidden="true" />
        )}
      </Button>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative mr-2"
            aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground"
                aria-hidden="true"
              >
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-80"
          aria-label="Lista de notificações"
        >
          <DropdownMenuLabel className="flex items-center justify-between">
            <span id="notifications-title">Notificações</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={markAllAsRead}
              >
                Marcar todas como lidas
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Live region for notification updates */}
          <div 
            role="log"
            aria-live="polite"
            aria-label="Atualizações de notificações"
            className="sr-only"
          >
            {unreadCount > 0 && `${unreadCount} notificações não lidas`}
          </div>

          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div role="list" aria-labelledby="notifications-title">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  onClick={() => markAsRead(notification.id)}
                  role="listitem"
                  aria-label={`${notification.title}: ${notification.description}. ${notification.time}${!notification.read ? ". Não lida" : ""}`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !notification.read && "text-foreground",
                        notification.read && "text-muted-foreground"
                      )}
                    >
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <Badge 
                        variant="secondary" 
                        className="ml-auto h-1.5 w-1.5 rounded-full p-0 bg-primary"
                        aria-label="Não lida"
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {notification.description}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    {notification.time}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer justify-center">
            <Link href="/dashboard/notifications" className="text-sm text-primary">
              Ver todas as notificações
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Avatar (visible on mobile) */}
      <div className="lg:hidden" aria-hidden="true">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
      </div>
    </header>
  )
}
