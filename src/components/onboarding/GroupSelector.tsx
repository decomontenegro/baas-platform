"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, Check, Loader2, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Group {
  id: string
  name: string
  participants: number
  lastActivity?: string
}

// Mock groups - replace with actual API call
const mockGroups: Group[] = [
  { id: "1", name: "Família Silva 👨‍👩‍👧‍👦", participants: 12, lastActivity: "Agora" },
  { id: "2", name: "Trabalho - Marketing", participants: 8, lastActivity: "5 min" },
  { id: "3", name: "Amigos da Faculdade 🎓", participants: 25, lastActivity: "1h" },
  { id: "4", name: "Condomínio Edifício Sol", participants: 45, lastActivity: "2h" },
  { id: "5", name: "Futebol Sábado ⚽", participants: 15, lastActivity: "3h" },
]

interface GroupSelectorProps {
  selectedId: string | null
  onSelect: (groupId: string) => void
  className?: string
}

export function GroupSelector({
  selectedId,
  onSelect,
  className,
}: GroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Simulate fetching groups
  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setGroups(mockGroups)
      setIsLoading(false)
    }
    fetchGroups()
  }, [])

  const refreshGroups = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setGroups(mockGroups)
    setIsLoading(false)
  }

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Escolha um grupo</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Selecione o primeiro grupo onde o bot será ativado. Você pode adicionar mais grupos depois.
        </p>
      </div>

      {/* Search and refresh */}
      <div className="flex gap-2 max-w-md mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar grupo..."
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refreshGroups}
          disabled={isLoading}
          aria-label="Atualizar lista de grupos"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Groups list */}
      <div className="max-w-md mx-auto space-y-2 max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p className="text-sm">Carregando grupos...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-8 w-8 mb-2" />
            <p className="text-sm">
              {searchQuery ? "Nenhum grupo encontrado" : "Nenhum grupo disponível"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredGroups.map((group, index) => {
              const isSelected = selectedId === group.id

              return (
                <motion.button
                  key={group.id}
                  onClick={() => onSelect(group.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {/* Group avatar */}
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      isSelected ? "bg-primary/20" : "bg-muted"
                    )}
                  >
                    <Users
                      className={cn(
                        "h-5 w-5",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Group info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{group.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{group.participants} participantes</span>
                      {group.lastActivity && (
                        <>
                          <span>•</span>
                          <span>{group.lastActivity}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check className="h-4 w-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
