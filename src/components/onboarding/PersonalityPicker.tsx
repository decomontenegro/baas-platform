"use client"

import { motion } from "framer-motion"
import { Smile, Briefcase, Coffee, GraduationCap, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PersonalityType } from "@/hooks/use-onboarding"

interface PersonalityOption {
  id: PersonalityType
  name: string
  description: string
  icon: React.ReactNode
  example: string
  color: string
}

const personalities: PersonalityOption[] = [
  {
    id: "friendly",
    name: "Amigável",
    description: "Simpático e acolhedor, usa emojis e linguagem informal",
    icon: <Smile className="h-6 w-6" />,
    example: "Oi! 👋 Como posso te ajudar hoje?",
    color: "from-yellow-500/20 to-orange-500/20 border-yellow-500/50",
  },
  {
    id: "professional",
    name: "Profissional",
    description: "Formal e objetivo, ideal para contextos corporativos",
    icon: <Briefcase className="h-6 w-6" />,
    example: "Olá. Como posso auxiliá-lo?",
    color: "from-blue-500/20 to-indigo-500/20 border-blue-500/50",
  },
  {
    id: "casual",
    name: "Descontraído",
    description: "Relaxado e divertido, usa gírias e piadas",
    icon: <Coffee className="h-6 w-6" />,
    example: "E aí! 😎 Bora resolver isso?",
    color: "from-green-500/20 to-teal-500/20 border-green-500/50",
  },
  {
    id: "formal",
    name: "Formal",
    description: "Respeitoso e educado, linguagem elaborada",
    icon: <GraduationCap className="h-6 w-6" />,
    example: "Prezado(a), em que posso ser útil?",
    color: "from-purple-500/20 to-pink-500/20 border-purple-500/50",
  },
]

interface PersonalityPickerProps {
  selected: PersonalityType
  onSelect: (personality: PersonalityType) => void
  className?: string
}

export function PersonalityPicker({
  selected,
  onSelect,
  className,
}: PersonalityPickerProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Escolha a personalidade do bot</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Como você quer que seu assistente se comunique? Você pode mudar isso depois.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {personalities.map((personality, index) => {
          const isSelected = selected === personality.id

          return (
            <motion.button
              key={personality.id}
              onClick={() => onSelect(personality.id)}
              className={cn(
                "relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all",
                "bg-gradient-to-br hover:shadow-md",
                isSelected
                  ? `${personality.color} shadow-md`
                  : "border-muted bg-muted/30 hover:border-muted-foreground/30"
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Selected indicator */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Icon */}
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg mb-3",
                  isSelected ? "bg-white/50 dark:bg-black/20" : "bg-muted"
                )}
              >
                {personality.icon}
              </div>

              {/* Content */}
              <h4 className="font-semibold">{personality.name}</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                {personality.description}
              </p>

              {/* Example bubble */}
              <div className="w-full p-3 rounded-lg bg-background/60 border text-sm">
                <span className="text-xs text-muted-foreground block mb-1">
                  Exemplo:
                </span>
                "{personality.example}"
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// Need to import AnimatePresence at the top
import { AnimatePresence } from "framer-motion"
