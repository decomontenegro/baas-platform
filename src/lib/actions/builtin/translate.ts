import { ActionHandler, ActionContext, ActionResult, TranslateConfig, QuickActionType } from '../types'
import { parseLanguage } from '../parser'

/**
 * /traduzir [idioma] - Translate the last message
 */
export const translateHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: TranslateConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    // Get target language
    const targetArg = args[0]
    let targetLang = config.defaultTarget || 'en'
    
    if (targetArg) {
      const parsed = parseLanguage(targetArg)
      if (parsed) {
        targetLang = parsed
      } else {
        // Check if it's a supported language code
        const supported = config.supportedLanguages || ['en', 'es', 'fr', 'de', 'it', 'pt']
        if (!supported.includes(targetArg.toLowerCase())) {
          return {
            success: false,
            error: `🌐 Idioma "${targetArg}" não reconhecido.

**Idiomas suportados:**
${supported.map(l => `• ${getLanguageName(l)} (${l})`).join('\n')}`,
            durationMs: Date.now() - startTime,
          }
        }
        targetLang = targetArg.toLowerCase()
      }
    }

    // Get text to translate (from args or last message)
    let textToTranslate = args.slice(1).join(' ').trim()
    
    if (!textToTranslate) {
      // Get last user message from context
      const lastMessage = context.recentMessages
        ?.filter(m => m.role === 'user')
        ?.slice(-2)?.[0] // Get second to last (before the /traduzir command)
      
      if (!lastMessage) {
        return {
          success: false,
          error: `🌐 Nenhuma mensagem para traduzir.

**Uso:**
• /traduzir [idioma] - traduz a última mensagem
• /traduzir [idioma] [texto] - traduz o texto informado

**Exemplos:**
• /traduzir inglês
• /traduzir en Hello, how are you?`,
          durationMs: Date.now() - startTime,
        }
      }
      
      textToTranslate = lastMessage.content
    }

    // In production, call a translation API (Google Translate, DeepL, etc.)
    // For now, return a placeholder
    const translation = await mockTranslate(textToTranslate, targetLang)

    const targetLangName = getLanguageName(targetLang)
    
    return {
      success: true,
      output: `🌐 **Tradução para ${targetLangName}:**

📝 Original:
${textToTranslate}

🔤 Tradução:
${translation}`,
      data: {
        originalText: textToTranslate,
        translatedText: translation,
        targetLanguage: targetLang,
        sourceLangDetected: config.autoDetect ? 'pt' : undefined,
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao traduzir: ${message}`,
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Mock translation (placeholder for real API)
 */
async function mockTranslate(text: string, targetLang: string): Promise<string> {
  // In production, integrate with:
  // - Google Cloud Translation API
  // - DeepL API
  // - Azure Translator
  // - OpenAI GPT for translation
  
  // For now, return a note that translation would happen here
  return `[Tradução para ${getLanguageName(targetLang)} seria aplicada aqui via API de tradução]

${text}

⚠️ _Para ativar traduções reais, configure uma API de tradução (Google, DeepL, etc.)_`
}

/**
 * Get language display name
 */
function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    pt: 'Português',
    en: 'Inglês',
    es: 'Espanhol',
    fr: 'Francês',
    de: 'Alemão',
    it: 'Italiano',
    ja: 'Japonês',
    zh: 'Chinês',
    ko: 'Coreano',
    ru: 'Russo',
    ar: 'Árabe',
    nl: 'Holandês',
  }
  
  return names[code] || code.toUpperCase()
}

export const translateAction = {
  type: QuickActionType.TRANSLATE,
  name: 'Traduzir',
  description: 'Traduz mensagens para outro idioma',
  trigger: '/traduzir',
  aliases: ['/translate', '/trad'],
  handler: translateHandler,
  defaultConfig: {
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'],
    autoDetect: true,
    defaultTarget: 'en',
  } as TranslateConfig,
  usage: '/traduzir [idioma] [texto opcional]',
  examples: [
    '/traduzir inglês',
    '/traduzir en Olá, como você está?',
    '/traduzir espanhol',
  ],
}
