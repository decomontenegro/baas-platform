"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Sparkles, Building2, User, Rocket, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  StepIndicator, 
  WhatsAppConnect, 
  PersonalityPicker, 
  TestChat,
  GroupSelector 
} from "@/components/onboarding"
import { useOnboarding } from "@/hooks/use-onboarding"
import { cn } from "@/lib/utils"

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
}

export default function OnboardingPage() {
  const router = useRouter()
  const {
    state,
    isLoading,
    totalSteps,
    nextStep,
    prevStep,
    setUsageType,
    setWhatsAppConnected,
    setSelectedGroup,
    setPersonality,
    setTestMessageSent,
    completeOnboarding,
    canProceed,
  } = useOnboarding()

  // Redirect if already completed
  useEffect(() => {
    if (!isLoading && state.completed) {
      router.push("/dashboard")
    }
  }, [isLoading, state.completed, router])

  const handleComplete = () => {
    completeOnboarding()
    router.push("/dashboard")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center py-8">
      <Card className="w-full max-w-3xl">
        <CardContent className="p-6 sm:p-8">
          {/* Step indicator */}
          <StepIndicator
            currentStep={state.currentStep}
            totalSteps={totalSteps}
            className="mb-8"
          />

          {/* Step content */}
          <div className="min-h-[400px] flex flex-col">
            <AnimatePresence mode="wait" initial={false} custom={1}>
              <motion.div
                key={state.currentStep}
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex-1"
              >
                {/* Step 1: Welcome */}
                {state.currentStep === 1 && (
                  <div className="flex flex-col items-center text-center space-y-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      <Sparkles className="h-16 w-16 text-primary" />
                    </motion.div>
                    
                    <div className="space-y-3">
                      <h1 className="text-2xl sm:text-3xl font-bold">
                        Bem-vindo ao BaaS! 🎉
                      </h1>
                      <p className="text-muted-foreground max-w-md">
                        Vamos configurar seu assistente de WhatsApp em poucos passos. 
                        Primeiro, como você pretende usar?
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                      <motion.button
                        onClick={() => setUsageType("personal")}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                          state.usageType === "personal"
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-full",
                          state.usageType === "personal"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <User className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Pessoal</h3>
                          <p className="text-xs text-muted-foreground">
                            Família, amigos, hobbies
                          </p>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={() => setUsageType("business")}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                          state.usageType === "business"
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-full",
                          state.usageType === "business"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <Building2 className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Empresa</h3>
                          <p className="text-xs text-muted-foreground">
                            Negócios, equipes, clientes
                          </p>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Step 2: WhatsApp Connect */}
                {state.currentStep === 2 && (
                  <WhatsAppConnect
                    onConnect={() => setWhatsAppConnected(true)}
                  />
                )}

                {/* Step 3: Group Selection */}
                {state.currentStep === 3 && (
                  <GroupSelector
                    selectedId={state.selectedGroupId}
                    onSelect={(id) => setSelectedGroup(id)}
                  />
                )}

                {/* Step 4: Personality */}
                {state.currentStep === 4 && (
                  <PersonalityPicker
                    selected={state.personality}
                    onSelect={setPersonality}
                  />
                )}

                {/* Step 5: Test */}
                {state.currentStep === 5 && (
                  <TestChat
                    personality={state.personality}
                    onTestComplete={() => setTestMessageSent(true)}
                  />
                )}

                {/* Step 6: Success */}
                {state.currentStep === 6 && (
                  <div className="flex flex-col items-center text-center space-y-8 py-8">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    >
                      <div className="relative">
                        <PartyPopper className="h-20 w-20 text-primary" />
                        <motion.div
                          className="absolute -top-2 -right-2"
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 10, -10, 0],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Sparkles className="h-8 w-8 text-yellow-500" />
                        </motion.div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-3"
                    >
                      <h1 className="text-2xl sm:text-3xl font-bold">
                        Tudo pronto! 🚀
                      </h1>
                      <p className="text-muted-foreground max-w-md">
                        Seu assistente está configurado e pronto para usar. 
                        Ele já está ativo no grupo selecionado!
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="bg-muted/50 rounded-xl p-6 w-full max-w-sm"
                    >
                      <h3 className="font-medium mb-3">Resumo</h3>
                      <ul className="text-sm text-left space-y-2 text-muted-foreground">
                        <li className="flex justify-between">
                          <span>Tipo de uso:</span>
                          <span className="font-medium text-foreground">
                            {state.usageType === "personal" ? "Pessoal" : "Empresa"}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>WhatsApp:</span>
                          <span className="font-medium text-green-600">Conectado ✓</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Personalidade:</span>
                          <span className="font-medium text-foreground capitalize">
                            {state.personality === "friendly" && "Amigável"}
                            {state.personality === "professional" && "Profissional"}
                            {state.personality === "casual" && "Descontraído"}
                            {state.personality === "formal" && "Formal"}
                          </span>
                        </li>
                      </ul>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                    >
                      <Button size="lg" onClick={handleComplete} className="gap-2">
                        <Rocket className="h-4 w-4" />
                        Ir para o Dashboard
                      </Button>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          {state.currentStep < 6 && (
            <div className="flex justify-between items-center mt-8 pt-6 border-t">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={state.currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>

              <Button
                onClick={nextStep}
                disabled={!canProceed(state.currentStep)}
                className="gap-2"
              >
                {state.currentStep === 5 ? "Finalizar" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skip option */}
      {state.currentStep < 6 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-4 text-sm text-muted-foreground"
        >
          Precisa de ajuda?{" "}
          <a
            href="#"
            className="text-primary hover:underline"
          >
            Entre em contato
          </a>
        </motion.p>
      )}
    </div>
  )
}
