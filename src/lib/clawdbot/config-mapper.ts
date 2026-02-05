/**
 * Clawdbot Configuration Mapper
 * Maps Dashboard configuration to Clawdbot format and vice versa
 */

import type { GroupConfig, PersonalityConfig } from './types';

// ============================================
// Personality to System Prompt Mapping
// ============================================

export interface SystemPromptOptions {
  personality: PersonalityConfig;
  additionalInstructions?: string;
  language?: string;
  context?: {
    groupName?: string;
    organizationName?: string;
    purpose?: string;
  };
}

/**
 * Generate a system prompt from personality sliders
 */
export function personalityToSystemPrompt(options: SystemPromptOptions): string {
  const { personality, additionalInstructions, language, context } = options;

  const parts: string[] = [];

  // Base identity
  parts.push('You are a helpful AI assistant');
  
  if (context?.organizationName) {
    parts[0] += ` for ${context.organizationName}`;
  }
  
  if (context?.groupName) {
    parts[0] += ` in the group "${context.groupName}"`;
  }

  parts[0] += '.';

  if (context?.purpose) {
    parts.push(`Your purpose is: ${context.purpose}`);
  }

  // Formality (0=casual, 100=formal)
  const formalityInstruction = getFormalityInstruction(personality.formality);
  if (formalityInstruction) {
    parts.push(formalityInstruction);
  }

  // Verbosity (0=concise, 100=verbose)
  const verbosityInstruction = getVerbosityInstruction(personality.verbosity);
  if (verbosityInstruction) {
    parts.push(verbosityInstruction);
  }

  // Creativity (0=conservative, 100=creative)
  const creativityInstruction = getCreativityInstruction(personality.creativity);
  if (creativityInstruction) {
    parts.push(creativityInstruction);
  }

  // Empathy (0=neutral, 100=empathetic)
  const empathyInstruction = getEmpathyInstruction(personality.empathy);
  if (empathyInstruction) {
    parts.push(empathyInstruction);
  }

  // Humor (0=serious, 100=playful)
  const humorInstruction = getHumorInstruction(personality.humor);
  if (humorInstruction) {
    parts.push(humorInstruction);
  }

  // Tone override
  if (personality.tone) {
    parts.push(`Maintain a ${personality.tone} tone throughout your responses.`);
  }

  // Language
  if (language || personality.language) {
    const lang = language || personality.language;
    parts.push(`Respond in ${getLanguageName(lang!)}.`);
  }

  // Custom instructions
  if (personality.customInstructions) {
    parts.push(personality.customInstructions);
  }

  if (additionalInstructions) {
    parts.push(additionalInstructions);
  }

  return parts.join('\n\n');
}

function getFormalityInstruction(value: number): string | null {
  if (value < 20) {
    return 'Use a very casual, relaxed communication style. Feel free to use slang, abbreviations, and informal expressions. Be like a friend chatting.';
  } else if (value < 40) {
    return 'Use a casual, friendly communication style. Keep things light and approachable while still being clear.';
  } else if (value < 60) {
    return 'Use a balanced communication style - neither too formal nor too casual. Be professional but approachable.';
  } else if (value < 80) {
    return 'Use a professional, polished communication style. Maintain a level of formality appropriate for business settings.';
  } else {
    return 'Use a highly formal, professional communication style. Be precise, courteous, and maintain proper etiquette at all times.';
  }
}

function getVerbosityInstruction(value: number): string | null {
  if (value < 20) {
    return 'Be extremely concise. Use the minimum words necessary to convey the message. Short sentences, bullet points when appropriate.';
  } else if (value < 40) {
    return 'Keep responses brief and to the point. Include essential information only, avoiding unnecessary elaboration.';
  } else if (value < 60) {
    return 'Provide balanced responses with enough detail to be helpful without being overwhelming.';
  } else if (value < 80) {
    return 'Provide thorough responses with detailed explanations. Include context and examples when helpful.';
  } else {
    return 'Provide comprehensive, detailed responses. Elaborate on topics, include examples, context, and explore related aspects thoroughly.';
  }
}

function getCreativityInstruction(value: number): string | null {
  if (value < 20) {
    return 'Stick strictly to facts and established information. Avoid speculation or creative interpretations. Be conservative and precise.';
  } else if (value < 40) {
    return 'Focus primarily on factual, well-established information. Only suggest alternatives when directly relevant.';
  } else if (value < 60) {
    return 'Balance factual information with thoughtful suggestions. Feel free to offer creative solutions when appropriate.';
  } else if (value < 80) {
    return 'Be creative and exploratory in your responses. Suggest novel approaches and think outside the box.';
  } else {
    return 'Be highly creative and innovative. Embrace unconventional thinking, propose novel ideas, and explore imaginative possibilities.';
  }
}

function getEmpathyInstruction(value: number): string | null {
  if (value < 20) {
    return 'Focus purely on information and solutions. Keep responses objective and task-focused.';
  } else if (value < 40) {
    return 'Be polite and respectful but focus primarily on providing information and solutions.';
  } else if (value < 60) {
    return 'Show appropriate empathy and understanding. Acknowledge feelings when relevant while maintaining focus on helping.';
  } else if (value < 80) {
    return 'Be warm and empathetic. Show genuine understanding of feelings and concerns. Make people feel heard and supported.';
  } else {
    return 'Be deeply empathetic and supportive. Prioritize emotional understanding and validation. Create a warm, caring atmosphere in every interaction.';
  }
}

function getHumorInstruction(value: number): string | null {
  if (value < 20) {
    return 'Maintain a serious, professional demeanor. Avoid humor or playfulness entirely.';
  } else if (value < 40) {
    return 'Keep a mostly serious tone. Occasional light moments are fine but keep them subtle.';
  } else if (value < 60) {
    return 'Feel free to use appropriate humor when it fits naturally. Balance seriousness with lightheartedness.';
  } else if (value < 80) {
    return 'Be playful and use humor liberally. Make interactions enjoyable and engaging with wit and levity.';
  } else {
    return 'Be fun and playful! Use humor, wordplay, and wit freely. Make every interaction enjoyable and entertaining.';
  }
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'en-US': 'American English',
    'en-GB': 'British English',
    'pt': 'Portuguese',
    'pt-BR': 'Brazilian Portuguese',
    'pt-PT': 'European Portuguese',
    'es': 'Spanish',
    'es-ES': 'Castilian Spanish',
    'es-MX': 'Mexican Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'nl': 'Dutch',
    'ru': 'Russian',
    'zh': 'Chinese',
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'he': 'Hebrew',
    'pl': 'Polish',
    'tr': 'Turkish',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'ms': 'Malay',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'cs': 'Czech',
    'uk': 'Ukrainian',
    'el': 'Greek',
    'ro': 'Romanian',
    'hu': 'Hungarian',
  };

  return languages[code] || code;
}

// ============================================
// Dashboard Config to Clawdbot Config
// ============================================

export interface ClawdbotGroupConfig {
  requireMention: boolean;
  mentionPatterns?: string[];
  historyLimit?: number;
  enabled?: boolean;
}

export interface ClawdbotChannelConfig {
  groups: Record<string, ClawdbotGroupConfig>;
  groupPolicy?: 'allowlist' | 'open' | 'disabled';
  groupAllowFrom?: string[];
}

export interface ClawdbotAgentConfig {
  id: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
  };
  workspace?: string;
  groupChat?: {
    mentionPatterns?: string[];
  };
}

/**
 * Map Dashboard GroupConfig to Clawdbot format
 */
export function dashboardToClawdbotConfig(
  dashboardConfig: GroupConfig,
  options?: {
    groupId: string;
    groupName?: string;
    organizationName?: string;
  }
): { groupConfig: ClawdbotGroupConfig; agentConfig?: Partial<ClawdbotAgentConfig>; systemPrompt?: string } {
  const groupConfig: ClawdbotGroupConfig = {
    requireMention: dashboardConfig.requireMention,
    enabled: dashboardConfig.enabled,
  };

  if (dashboardConfig.mentionPatterns?.length) {
    groupConfig.mentionPatterns = dashboardConfig.mentionPatterns;
  }

  if (dashboardConfig.historyLimit !== undefined) {
    groupConfig.historyLimit = dashboardConfig.historyLimit;
  }

  let systemPrompt: string | undefined;
  
  if (dashboardConfig.personality) {
    systemPrompt = personalityToSystemPrompt({
      personality: dashboardConfig.personality,
      additionalInstructions: dashboardConfig.systemPrompt,
      context: {
        groupName: options?.groupName,
        organizationName: options?.organizationName,
      },
    });
  } else if (dashboardConfig.systemPrompt) {
    systemPrompt = dashboardConfig.systemPrompt;
  }

  return {
    groupConfig,
    systemPrompt,
  };
}

/**
 * Map Clawdbot config to Dashboard GroupConfig format
 */
export function clawdbotToDashboardConfig(
  clawdbotConfig: ClawdbotGroupConfig,
  existingDashboard?: Partial<GroupConfig>
): GroupConfig {
  return {
    requireMention: clawdbotConfig.requireMention ?? true,
    mentionPatterns: clawdbotConfig.mentionPatterns,
    enabled: clawdbotConfig.enabled ?? true,
    historyLimit: clawdbotConfig.historyLimit,
    // Preserve existing dashboard-only fields
    personality: existingDashboard?.personality ?? {
      formality: 50,
      verbosity: 50,
      creativity: 50,
      empathy: 50,
      humor: 50,
    },
    systemPrompt: existingDashboard?.systemPrompt,
    agentId: existingDashboard?.agentId,
    rateLimit: existingDashboard?.rateLimit,
    features: existingDashboard?.features ?? {
      imageAnalysis: true,
      voiceMessages: false,
      codeExecution: false,
      webSearch: true,
    },
  };
}

// ============================================
// Preset Personalities
// ============================================

export interface PersonalityPreset {
  id: string;
  name: string;
  description: string;
  personality: PersonalityConfig;
  icon: string;
}

export const PERSONALITY_PRESETS: PersonalityPreset[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal, thorough, and business-appropriate',
    icon: '💼',
    personality: {
      formality: 80,
      verbosity: 60,
      creativity: 30,
      empathy: 40,
      humor: 20,
      tone: 'professional',
    },
  },
  {
    id: 'friendly',
    name: 'Friendly Helper',
    description: 'Warm, approachable, and casual',
    icon: '😊',
    personality: {
      formality: 30,
      verbosity: 50,
      creativity: 60,
      empathy: 80,
      humor: 60,
      tone: 'friendly',
    },
  },
  {
    id: 'concise',
    name: 'Quick & Concise',
    description: 'Brief, direct, no-nonsense',
    icon: '⚡',
    personality: {
      formality: 50,
      verbosity: 10,
      creativity: 40,
      empathy: 30,
      humor: 20,
      tone: 'direct',
    },
  },
  {
    id: 'creative',
    name: 'Creative Thinker',
    description: 'Imaginative, exploratory, innovative',
    icon: '🎨',
    personality: {
      formality: 40,
      verbosity: 70,
      creativity: 90,
      empathy: 60,
      humor: 50,
      tone: 'creative',
    },
  },
  {
    id: 'support',
    name: 'Customer Support',
    description: 'Helpful, patient, solution-focused',
    icon: '🎧',
    personality: {
      formality: 60,
      verbosity: 50,
      creativity: 40,
      empathy: 85,
      humor: 30,
      tone: 'supportive',
    },
  },
  {
    id: 'technical',
    name: 'Technical Expert',
    description: 'Precise, detailed, fact-focused',
    icon: '🔧',
    personality: {
      formality: 70,
      verbosity: 80,
      creativity: 20,
      empathy: 30,
      humor: 10,
      tone: 'technical',
    },
  },
  {
    id: 'casual',
    name: 'Casual Chat',
    description: 'Like talking to a friend',
    icon: '💬',
    personality: {
      formality: 10,
      verbosity: 40,
      creativity: 70,
      empathy: 70,
      humor: 80,
      tone: 'casual',
    },
  },
  {
    id: 'educator',
    name: 'Educator',
    description: 'Patient, thorough explanations',
    icon: '📚',
    personality: {
      formality: 50,
      verbosity: 75,
      creativity: 60,
      empathy: 70,
      humor: 40,
      tone: 'educational',
    },
  },
];

export function getPresetById(id: string): PersonalityPreset | undefined {
  return PERSONALITY_PRESETS.find(p => p.id === id);
}

// ============================================
// Config Validation
// ============================================

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateGroupConfig(config: Partial<GroupConfig>): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate personality sliders (0-100)
  if (config.personality) {
    const sliders = ['formality', 'verbosity', 'creativity', 'empathy', 'humor'] as const;
    for (const slider of sliders) {
      const value = config.personality[slider];
      if (value !== undefined && (value < 0 || value > 100)) {
        errors.push(`Personality ${slider} must be between 0 and 100`);
      }
    }
  }

  // Validate mention patterns
  if (config.mentionPatterns) {
    for (const pattern of config.mentionPatterns) {
      try {
        new RegExp(pattern);
      } catch {
        errors.push(`Invalid regex pattern: ${pattern}`);
      }
    }
  }

  // Validate history limit
  if (config.historyLimit !== undefined) {
    if (config.historyLimit < 0 || config.historyLimit > 1000) {
      errors.push('History limit must be between 0 and 1000');
    }
  }

  // Validate rate limits
  if (config.rateLimit) {
    if (config.rateLimit.maxMessagesPerMinute !== undefined && config.rateLimit.maxMessagesPerMinute < 1) {
      errors.push('Max messages per minute must be at least 1');
    }
    if (config.rateLimit.maxTokensPerDay !== undefined && config.rateLimit.maxTokensPerDay < 100) {
      warnings.push('Max tokens per day is very low, bot may not be able to respond properly');
    }
  }

  // Warnings for missing config
  if (!config.personality) {
    warnings.push('No personality configured, default will be used');
  }

  if (config.enabled && config.requireMention && !config.mentionPatterns?.length) {
    warnings.push('Mention required but no mention patterns configured - bot will only respond to native @mentions');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// Config Diff
// ============================================

export interface ConfigDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export function diffConfigs(
  oldConfig: Partial<GroupConfig>,
  newConfig: Partial<GroupConfig>
): ConfigDiff[] {
  const diffs: ConfigDiff[] = [];
  const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);

  for (const key of allKeys) {
    const oldValue = (oldConfig as Record<string, unknown>)[key];
    const newValue = (newConfig as Record<string, unknown>)[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({ field: key, oldValue, newValue });
    }
  }

  return diffs;
}
