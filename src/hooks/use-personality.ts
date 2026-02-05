import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, postData, patchData } from '@/lib/api'
import type { Personality, PersonalityTemplate } from '@/types'

// Fetch all personalities
export function usePersonalities() {
  const { data, error, isLoading, mutate } = useSWR<Personality[]>(
    '/personalities',
    fetcher
  )

  return {
    personalities: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Fetch current/default personality
export function useCurrentPersonality() {
  const { data, error, isLoading, mutate } = useSWR<Personality>(
    '/personalities/current',
    fetcher
  )

  return {
    personality: data,
    isLoading,
    isError: error,
    mutate,
  }
}

// Fetch personality templates
export function usePersonalityTemplates() {
  const { data, error, isLoading } = useSWR<PersonalityTemplate[]>(
    '/personalities/templates',
    fetcher
  )

  return {
    templates: data || mockTemplates,
    isLoading,
    isError: error,
  }
}

// Create personality mutation
async function createPersonalityFn(url: string, { arg }: { arg: Partial<Personality> }) {
  return postData<Personality>(url, arg)
}

export function useCreatePersonality() {
  const { trigger, isMutating, error } = useSWRMutation('/personalities', createPersonalityFn)
  
  return {
    createPersonality: trigger,
    isCreating: isMutating,
    error,
  }
}

// Update personality mutation
async function updatePersonalityFn(url: string, { arg }: { arg: Partial<Personality> }) {
  return patchData<Personality>(url, arg)
}

export function useUpdatePersonality(id: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    id ? `/personalities/${id}` : null,
    updatePersonalityFn
  )
  
  return {
    updatePersonality: trigger,
    isUpdating: isMutating,
    error,
  }
}

// Mock templates
export const mockTemplates: PersonalityTemplate[] = [
  {
    id: 'professional',
    name: 'Professional Assistant',
    description: 'Formal, helpful, and focused on efficiency',
    icon: '💼',
    systemPrompt: 'You are a professional assistant. Be formal, concise, and helpful. Focus on providing accurate information efficiently.',
    defaults: {
      temperature: 0.7,
      creativity: 40,
      formality: 80,
      verbosity: 50,
      empathy: 60,
      humor: 20,
    },
  },
  {
    id: 'friendly',
    name: 'Friendly Helper',
    description: 'Warm, casual, and approachable',
    icon: '😊',
    systemPrompt: 'You are a friendly and approachable assistant. Be warm, use casual language, and make users feel comfortable asking questions.',
    defaults: {
      temperature: 0.8,
      creativity: 60,
      formality: 30,
      verbosity: 60,
      empathy: 85,
      humor: 70,
    },
  },
  {
    id: 'technical',
    name: 'Technical Expert',
    description: 'Deep technical knowledge with precision',
    icon: '🔧',
    systemPrompt: 'You are a technical expert. Provide detailed, accurate technical information. Use proper terminology and explain complex concepts clearly.',
    defaults: {
      temperature: 0.5,
      creativity: 30,
      formality: 70,
      verbosity: 70,
      empathy: 40,
      humor: 10,
    },
  },
  {
    id: 'creative',
    name: 'Creative Partner',
    description: 'Imaginative, inspiring, and innovative',
    icon: '🎨',
    systemPrompt: 'You are a creative partner. Think outside the box, suggest innovative ideas, and help users explore creative solutions.',
    defaults: {
      temperature: 0.9,
      creativity: 95,
      formality: 40,
      verbosity: 65,
      empathy: 70,
      humor: 60,
    },
  },
  {
    id: 'supportive',
    name: 'Supportive Coach',
    description: 'Encouraging, patient, and motivational',
    icon: '🌟',
    systemPrompt: 'You are a supportive coach. Be patient, encouraging, and help users feel confident. Celebrate their progress and guide them gently.',
    defaults: {
      temperature: 0.75,
      creativity: 50,
      formality: 40,
      verbosity: 60,
      empathy: 95,
      humor: 50,
    },
  },
  {
    id: 'concise',
    name: 'Quick Responder',
    description: 'Brief, direct, and to the point',
    icon: '⚡',
    systemPrompt: 'You are a quick responder. Be extremely concise and direct. Avoid unnecessary words and get straight to the point.',
    defaults: {
      temperature: 0.6,
      creativity: 30,
      formality: 60,
      verbosity: 15,
      empathy: 40,
      humor: 20,
    },
  },
]

// Mock current personality
export const mockPersonality: Personality = {
  id: '1',
  name: 'Custom Bot',
  description: 'My customized AI assistant',
  systemPrompt: 'You are a helpful AI assistant. Be friendly, informative, and always aim to provide the best possible assistance.',
  temperature: 0.7,
  creativity: 60,
  formality: 50,
  verbosity: 55,
  empathy: 70,
  humor: 45,
  isDefault: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-20T10:00:00Z',
}
