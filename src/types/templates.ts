// Template Types for BaaS Dashboard

export interface TemplateCategory {
  id: string
  name: string
  slug: string
  icon: string
  description?: string
  sortOrder: number
  isActive: boolean
  templates?: Template[]
  createdAt: string
  updatedAt: string
}

export interface TemplatePersonality {
  creativity: number  // 0-100
  formality: number   // 0-100
  verbosity: number   // 0-100
  empathy: number     // 0-100
  humor: number       // 0-100
}

export interface TemplateHandoffRules {
  enabled: boolean
  triggers: string[]       // Keywords/phrases that trigger handoff
  message: string          // Message sent when handing off
  emailNotification?: boolean
  slackNotification?: boolean
}

export interface TemplateExampleMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TemplateConfig {
  systemPrompt: string
  personality: TemplatePersonality
  welcomeMessage: string
  suggestedKnowledge: string[]
  handoffRules: TemplateHandoffRules
  quickReplies: string[]
  exampleConversations: TemplateExampleMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface Template {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string
  category?: TemplateCategory
  authorId?: string
  icon: string
  color: string
  thumbnail?: string
  config: TemplateConfig
  tags: string[]
  usageCount: number
  rating?: number
  ratingCount: number
  isPublic: boolean
  isOfficial: boolean
  isFeatured: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// For applying a template to a channel
export interface ApplyTemplateOptions {
  channelId: string
  templateId: string
  customizations?: Partial<TemplateConfig>
}

// Template filters for browsing
export interface TemplateFilters {
  categoryId?: string
  search?: string
  tags?: string[]
  isOfficial?: boolean
  isFeatured?: boolean
  sortBy?: 'popular' | 'newest' | 'rating' | 'name'
}
