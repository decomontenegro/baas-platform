/**
 * Admin Agent Personality System
 * 
 * Sistema de personalidade configurável para customizar
 * o tom e estilo de comunicação do Admin Agent.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export type Tone = 'formal' | 'casual' | 'technical';
export type Language = 'pt-BR' | 'en' | 'es';
export type AlertFrequency = 'high' | 'medium' | 'low';

export interface AdminAgentPersonality {
  tone: Tone;
  language: Language;
  useEmoji: boolean;
  alertFrequency: AlertFrequency;
}

export type MessageType = 
  | 'greeting'
  | 'alert'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'farewell';

// ============================================================================
// Default Personality
// ============================================================================

export const DEFAULT_PERSONALITY: AdminAgentPersonality = {
  tone: 'casual',
  language: 'pt-BR',
  useEmoji: true,
  alertFrequency: 'medium',
};

// ============================================================================
// Message Templates
// ============================================================================

const MESSAGE_TEMPLATES: Record<Language, Record<Tone, Record<MessageType, string>>> = {
  'pt-BR': {
    formal: {
      greeting: 'Prezado administrador, boa {timeOfDay}.',
      alert: 'Notificação importante: {message}',
      success: 'Operação concluída com êxito: {message}',
      error: 'Erro detectado: {message}',
      warning: 'Atenção necessária: {message}',
      info: 'Informação: {message}',
      farewell: 'Atenciosamente, Admin Agent.',
    },
    casual: {
      greeting: 'E aí! {timeOfDay} pra você!',
      alert: 'Ei, olha isso: {message}',
      success: 'Deu certo! {message}',
      error: 'Ops, deu ruim: {message}',
      warning: 'Fica ligado: {message}',
      info: 'Info: {message}',
      farewell: 'Falou!',
    },
    technical: {
      greeting: '[INIT] Session started.',
      alert: '[ALERT] {message}',
      success: '[OK] {message}',
      error: '[ERR] {message}',
      warning: '[WARN] {message}',
      info: '[INFO] {message}',
      farewell: '[END] Session terminated.',
    },
  },
  'en': {
    formal: {
      greeting: 'Good {timeOfDay}, Administrator.',
      alert: 'Important notification: {message}',
      success: 'Operation completed successfully: {message}',
      error: 'Error detected: {message}',
      warning: 'Attention required: {message}',
      info: 'Information: {message}',
      farewell: 'Best regards, Admin Agent.',
    },
    casual: {
      greeting: 'Hey! Good {timeOfDay}!',
      alert: 'Heads up: {message}',
      success: 'Nailed it! {message}',
      error: 'Oops, something broke: {message}',
      warning: 'Watch out: {message}',
      info: 'FYI: {message}',
      farewell: 'Catch ya later!',
    },
    technical: {
      greeting: '[INIT] Session started.',
      alert: '[ALERT] {message}',
      success: '[OK] {message}',
      error: '[ERR] {message}',
      warning: '[WARN] {message}',
      info: '[INFO] {message}',
      farewell: '[END] Session terminated.',
    },
  },
  'es': {
    formal: {
      greeting: 'Estimado administrador, buenas {timeOfDay}.',
      alert: 'Notificación importante: {message}',
      success: 'Operación completada con éxito: {message}',
      error: 'Error detectado: {message}',
      warning: 'Atención requerida: {message}',
      info: 'Información: {message}',
      farewell: 'Atentamente, Admin Agent.',
    },
    casual: {
      greeting: '¡Hola! ¡Buenas {timeOfDay}!',
      alert: 'Ojo con esto: {message}',
      success: '¡Listo! {message}',
      error: 'Ups, algo falló: {message}',
      warning: 'Atentos: {message}',
      info: 'Info: {message}',
      farewell: '¡Hasta luego!',
    },
    technical: {
      greeting: '[INIT] Sesión iniciada.',
      alert: '[ALERT] {message}',
      success: '[OK] {message}',
      error: '[ERR] {message}',
      warning: '[WARN] {message}',
      info: '[INFO] {message}',
      farewell: '[END] Sesión terminada.',
    },
  },
};

// ============================================================================
// Emoji Maps
// ============================================================================

const EMOJI_MAP: Record<MessageType, string> = {
  greeting: '👋',
  alert: '🚨',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  farewell: '👋',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getTimeOfDay(language: Language): string {
  const hour = new Date().getHours();
  
  const timeMap: Record<Language, { morning: string; afternoon: string; evening: string; night: string }> = {
    'pt-BR': { morning: 'dia', afternoon: 'tarde', evening: 'tarde', night: 'noite' },
    'en': { morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'night' },
    'es': { morning: 'días', afternoon: 'tardes', evening: 'tardes', night: 'noches' },
  };

  const times = timeMap[language];
  
  if (hour >= 5 && hour < 12) return times.morning;
  if (hour >= 12 && hour < 18) return times.afternoon;
  if (hour >= 18 && hour < 21) return times.evening;
  return times.night;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Formata uma mensagem com base na personalidade configurada
 */
export function formatMessage(
  type: MessageType,
  message: string,
  personality: AdminAgentPersonality = DEFAULT_PERSONALITY
): string {
  const template = MESSAGE_TEMPLATES[personality.language][personality.tone][type];
  const timeOfDay = getTimeOfDay(personality.language);
  
  let formatted = template
    .replace('{message}', message)
    .replace('{timeOfDay}', timeOfDay);

  if (personality.useEmoji && personality.tone !== 'technical') {
    formatted = `${EMOJI_MAP[type]} ${formatted}`;
  }

  return formatted;
}

/**
 * Formata uma saudação personalizada
 */
export function formatGreeting(
  personality: AdminAgentPersonality = DEFAULT_PERSONALITY
): string {
  return formatMessage('greeting', '', personality);
}

/**
 * Formata uma despedida personalizada
 */
export function formatFarewell(
  personality: AdminAgentPersonality = DEFAULT_PERSONALITY
): string {
  return formatMessage('farewell', '', personality);
}

/**
 * Formata um alerta com base na severidade e personalidade
 */
export function formatAlert(
  message: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
  personality: AdminAgentPersonality = DEFAULT_PERSONALITY
): string {
  // Determina o tipo de mensagem baseado na severidade
  const typeMap: Record<string, MessageType> = {
    critical: 'error',
    high: 'alert',
    medium: 'warning',
    low: 'info',
  };

  return formatMessage(typeMap[severity], message, personality);
}

/**
 * Verifica se um alerta deve ser enviado com base na frequência configurada
 */
export function shouldSendAlert(
  severity: 'critical' | 'high' | 'medium' | 'low',
  personality: AdminAgentPersonality = DEFAULT_PERSONALITY
): boolean {
  const frequencyThresholds: Record<AlertFrequency, string[]> = {
    high: ['critical', 'high', 'medium', 'low'],
    medium: ['critical', 'high', 'medium'],
    low: ['critical', 'high'],
  };

  return frequencyThresholds[personality.alertFrequency].includes(severity);
}

/**
 * Formata múltiplas mensagens em um resumo
 */
export function formatSummary(
  items: Array<{ type: MessageType; message: string }>,
  personality: AdminAgentPersonality = DEFAULT_PERSONALITY
): string {
  const header = personality.useEmoji && personality.tone !== 'technical'
    ? '📋 '
    : '';
  
  const summaryTitle: Record<Language, string> = {
    'pt-BR': 'Resumo',
    'en': 'Summary',
    'es': 'Resumen',
  };

  const lines = items.map(item => 
    `  • ${formatMessage(item.type, item.message, { ...personality, useEmoji: false })}`
  );

  return `${header}${summaryTitle[personality.language]}:\n${lines.join('\n')}`;
}

/**
 * Cria uma nova personalidade mesclando com valores padrão
 */
export function createPersonality(
  overrides: Partial<AdminAgentPersonality>
): AdminAgentPersonality {
  return { ...DEFAULT_PERSONALITY, ...overrides };
}

/**
 * Valida uma configuração de personalidade
 */
export function validatePersonality(
  personality: Partial<AdminAgentPersonality>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (personality.tone && !['formal', 'casual', 'technical'].includes(personality.tone)) {
    errors.push(`Invalid tone: ${personality.tone}. Must be 'formal', 'casual', or 'technical'.`);
  }

  if (personality.language && !['pt-BR', 'en', 'es'].includes(personality.language)) {
    errors.push(`Invalid language: ${personality.language}. Must be 'pt-BR', 'en', or 'es'.`);
  }

  if (personality.alertFrequency && !['high', 'medium', 'low'].includes(personality.alertFrequency)) {
    errors.push(`Invalid alertFrequency: ${personality.alertFrequency}. Must be 'high', 'medium', or 'low'.`);
  }

  if (personality.useEmoji !== undefined && typeof personality.useEmoji !== 'boolean') {
    errors.push(`Invalid useEmoji: must be a boolean.`);
  }

  return { valid: errors.length === 0, errors };
}
