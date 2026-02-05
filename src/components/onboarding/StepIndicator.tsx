"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  className?: string
}

const stepLabels = [
  "Boas-vindas",
  "WhatsApp",
  "Grupo",
  "Personalidade",
  "Teste",
  "Pronto!",
]

export function StepIndicator({
  currentStep,
  totalSteps,
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Progress bar */}
      <div className="relative mb-8">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <motion.div
          className="absolute top-4 left-0 h-0.5 bg-primary"
          initial={{ width: "0%" }}
          animate={{
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />

        {/* Step circles */}
        <div className="relative flex justify-between">
          {Array.from({ length: totalSteps }, (_, i) => {
            const step = i + 1
            const isCompleted = step < currentStep
            const isCurrent = step === currentStep

            return (
              <div key={step} className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                      ? "border-primary bg-background text-primary"
                      : "border-muted bg-background text-muted-foreground"
                  )}
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    step
                  )}
                </motion.div>
                <motion.span
                  className={cn(
                    "mt-2 text-xs font-medium hidden sm:block",
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  )}
                  initial={false}
                  animate={{
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {stepLabels[i]}
                </motion.span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
