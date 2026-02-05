// Integration types and interfaces
import type { IntegrationType, IntegrationStatus, IntegrationAction } from '@prisma/client'

// Integration categories for UI grouping
export const INTEGRATION_CATEGORIES = {
  CRM: 'CRM',
  CALENDAR: 'Calendar',
  HELPDESK: 'Helpdesk',
  STORAGE: 'Storage & Productivity',
  AUTOMATION: 'Automation',
  CUSTOM: 'Custom',
} as const

export type IntegrationCategory = keyof typeof INTEGRATION_CATEGORIES

// Integration metadata for UI
export interface IntegrationInfo {
  type: IntegrationType
  name: string
  description: string
  icon: string // emoji or icon name
  color: string
  category: IntegrationCategory
  features: string[]
  oauthRequired: boolean
  configFields?: ConfigField[]
  docsUrl?: string
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'email' | 'number' | 'boolean' | 'select' | 'multiselect'
  required?: boolean
  placeholder?: string
  description?: string
  options?: { label: string; value: string }[]
  validation?: {
    pattern?: string
    min?: number
    max?: number
  }
}

// OAuth configuration
export interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scopes: string[]
  redirectUri: string
}

// Integration credentials stored in DB (encrypted)
export interface IntegrationCredentials {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  apiKey?: string
  apiSecret?: string
  [key: string]: unknown
}

// Sync result
export interface SyncResult {
  success: boolean
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  errors?: string[]
  duration: number
}

// Webhook payload
export interface WebhookPayload {
  event: string
  data: Record<string, unknown>
  timestamp: string
  signature?: string
}

// Integration action context
export interface IntegrationContext {
  integrationId: string
  workspaceId: string
  tenantId: string
  credentials: IntegrationCredentials
  config: Record<string, unknown>
}

// CRM Contact
export interface CRMContact {
  id?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
  company?: string
  tags?: string[]
  customFields?: Record<string, unknown>
  source?: string
  createdAt?: Date
}

// Calendar Event
export interface CalendarEvent {
  id?: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  location?: string
  attendees?: { email: string; name?: string }[]
  calendarId?: string
  reminders?: { method: 'email' | 'popup'; minutes: number }[]
}

// Helpdesk Ticket
export interface HelpdeskTicket {
  id?: string
  subject: string
  description: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  status?: 'new' | 'open' | 'pending' | 'solved' | 'closed'
  requesterEmail?: string
  requesterName?: string
  tags?: string[]
  customFields?: Record<string, unknown>
}

// Storage Document
export interface StorageDocument {
  id?: string
  name: string
  content: string
  mimeType?: string
  parentId?: string
  url?: string
}

// Registry of all supported integrations
export const INTEGRATIONS_REGISTRY: Record<IntegrationType, IntegrationInfo> = {
  // CRM
  CRM_HUBSPOT: {
    type: 'CRM_HUBSPOT',
    name: 'HubSpot',
    description: 'Connect your HubSpot CRM to sync contacts and track conversations',
    icon: '🟠',
    color: '#ff7a59',
    category: 'CRM',
    features: ['Create contacts', 'Update contact info', 'Track conversations', 'Sync deals'],
    oauthRequired: true,
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
  },
  CRM_SALESFORCE: {
    type: 'CRM_SALESFORCE',
    name: 'Salesforce',
    description: 'Integrate with Salesforce CRM for enterprise contact management',
    icon: '☁️',
    color: '#00a1e0',
    category: 'CRM',
    features: ['Create leads', 'Update contacts', 'Log activities', 'Custom objects'],
    oauthRequired: true,
    docsUrl: 'https://developer.salesforce.com/docs',
  },
  CRM_PIPEDRIVE: {
    type: 'CRM_PIPEDRIVE',
    name: 'Pipedrive',
    description: 'Connect Pipedrive CRM to manage your sales pipeline',
    icon: '💚',
    color: '#017737',
    category: 'CRM',
    features: ['Create persons', 'Track deals', 'Log activities', 'Sync organizations'],
    oauthRequired: true,
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1',
  },
  CRM_RDSTATION: {
    type: 'CRM_RDSTATION',
    name: 'RD Station',
    description: 'Brazilian marketing and CRM platform integration',
    icon: '🔵',
    color: '#0066cc',
    category: 'CRM',
    features: ['Create contacts', 'Track conversions', 'Lead scoring', 'Marketing automation'],
    oauthRequired: true,
    docsUrl: 'https://developers.rdstation.com/',
  },
  // Calendar
  CALENDAR_GOOGLE: {
    type: 'CALENDAR_GOOGLE',
    name: 'Google Calendar',
    description: 'Schedule meetings and appointments directly in Google Calendar',
    icon: '📅',
    color: '#4285f4',
    category: 'CALENDAR',
    features: ['Create events', 'Check availability', 'Send invites', 'Sync reminders'],
    oauthRequired: true,
    docsUrl: 'https://developers.google.com/calendar/api',
  },
  CALENDAR_OUTLOOK: {
    type: 'CALENDAR_OUTLOOK',
    name: 'Outlook Calendar',
    description: 'Integrate with Microsoft Outlook for scheduling',
    icon: '📆',
    color: '#0078d4',
    category: 'CALENDAR',
    features: ['Create events', 'Teams meetings', 'Check availability', 'Send invites'],
    oauthRequired: true,
    docsUrl: 'https://docs.microsoft.com/en-us/graph/api/resources/calendar',
  },
  CALENDAR_CALCOM: {
    type: 'CALENDAR_CALCOM',
    name: 'Cal.com',
    description: 'Open-source scheduling platform for bookings',
    icon: '⏰',
    color: '#292929',
    category: 'CALENDAR',
    features: ['Create bookings', 'Available slots', 'Custom event types', 'Webhooks'],
    oauthRequired: false,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'eventTypeId', label: 'Event Type ID', type: 'text', required: false },
    ],
    docsUrl: 'https://cal.com/docs/api',
  },
  // Helpdesk
  HELPDESK_ZENDESK: {
    type: 'HELPDESK_ZENDESK',
    name: 'Zendesk',
    description: 'Create and manage support tickets in Zendesk',
    icon: '🎫',
    color: '#03363d',
    category: 'HELPDESK',
    features: ['Create tickets', 'Update status', 'Add comments', 'Assign agents'],
    oauthRequired: true,
    docsUrl: 'https://developer.zendesk.com/api-reference/',
  },
  HELPDESK_FRESHDESK: {
    type: 'HELPDESK_FRESHDESK',
    name: 'Freshdesk',
    description: 'Helpdesk integration for ticket management',
    icon: '🎯',
    color: '#2c9ced',
    category: 'HELPDESK',
    features: ['Create tickets', 'Auto-assign', 'SLA tracking', 'Canned responses'],
    oauthRequired: false,
    configFields: [
      { key: 'domain', label: 'Freshdesk Domain', type: 'text', required: true, placeholder: 'yourcompany.freshdesk.com' },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
    docsUrl: 'https://developers.freshdesk.com/api/',
  },
  HELPDESK_INTERCOM: {
    type: 'HELPDESK_INTERCOM',
    name: 'Intercom',
    description: 'Customer messaging platform with conversation tracking',
    icon: '💬',
    color: '#1f8ded',
    category: 'HELPDESK',
    features: ['Create conversations', 'User profiles', 'Tags & segments', 'Custom attributes'],
    oauthRequired: true,
    docsUrl: 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/',
  },
  // Storage
  STORAGE_S3: {
    type: 'STORAGE_S3',
    name: 'Amazon S3',
    description: 'Store files and attachments in S3',
    icon: '🪣',
    color: '#ff9900',
    category: 'STORAGE',
    features: ['Upload files', 'Generate URLs', 'Organize folders', 'Access control'],
    oauthRequired: false,
    configFields: [
      { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
      { key: 'region', label: 'Region', type: 'text', required: true },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    ],
    docsUrl: 'https://docs.aws.amazon.com/s3/',
  },
  STORAGE_GOOGLE_DRIVE: {
    type: 'STORAGE_GOOGLE_DRIVE',
    name: 'Google Drive',
    description: 'Save conversations and files to Google Drive',
    icon: '📁',
    color: '#4285f4',
    category: 'STORAGE',
    features: ['Upload files', 'Create folders', 'Share documents', 'Search files'],
    oauthRequired: true,
    docsUrl: 'https://developers.google.com/drive/api',
  },
  STORAGE_NOTION: {
    type: 'STORAGE_NOTION',
    name: 'Notion',
    description: 'Create pages and databases in Notion',
    icon: '📝',
    color: '#000000',
    category: 'STORAGE',
    features: ['Create pages', 'Update databases', 'Search content', 'Sync notes'],
    oauthRequired: true,
    docsUrl: 'https://developers.notion.com/',
  },
  STORAGE_AIRTABLE: {
    type: 'STORAGE_AIRTABLE',
    name: 'Airtable',
    description: 'Store data in Airtable bases and tables',
    icon: '📊',
    color: '#fcb400',
    category: 'STORAGE',
    features: ['Create records', 'Update tables', 'Query data', 'Attachments'],
    oauthRequired: false,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'baseId', label: 'Base ID', type: 'text', required: true },
      { key: 'tableId', label: 'Table ID', type: 'text', required: false },
    ],
    docsUrl: 'https://airtable.com/developers/web/api/introduction',
  },
  // Automation
  AUTOMATION_ZAPIER: {
    type: 'AUTOMATION_ZAPIER',
    name: 'Zapier',
    description: 'Trigger Zapier automations from bot events',
    icon: '⚡',
    color: '#ff4a00',
    category: 'AUTOMATION',
    features: ['Trigger workflows', 'Send data', 'Custom webhooks', '5000+ apps'],
    oauthRequired: false,
    configFields: [
      { key: 'webhookUrl', label: 'Zapier Webhook URL', type: 'url', required: true },
    ],
    docsUrl: 'https://zapier.com/developer',
  },
  AUTOMATION_MAKE: {
    type: 'AUTOMATION_MAKE',
    name: 'Make (Integromat)',
    description: 'Connect to Make scenarios for complex automation',
    icon: '🔄',
    color: '#6d00cc',
    category: 'AUTOMATION',
    features: ['Trigger scenarios', 'Complex workflows', 'Data mapping', 'Error handling'],
    oauthRequired: false,
    configFields: [
      { key: 'webhookUrl', label: 'Make Webhook URL', type: 'url', required: true },
    ],
    docsUrl: 'https://www.make.com/en/api-documentation',
  },
  // Payment (existing)
  PAYMENT_STRIPE: {
    type: 'PAYMENT_STRIPE',
    name: 'Stripe',
    description: 'Process payments through Stripe',
    icon: '💳',
    color: '#635bff',
    category: 'CUSTOM',
    features: ['Payment links', 'Invoices', 'Subscriptions'],
    oauthRequired: false,
    configFields: [
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false },
    ],
  },
  PAYMENT_MERCADOPAGO: {
    type: 'PAYMENT_MERCADOPAGO',
    name: 'Mercado Pago',
    description: 'Brazilian payment processing',
    icon: '💰',
    color: '#009ee3',
    category: 'CUSTOM',
    features: ['Pix payments', 'Payment links', 'Boletos'],
    oauthRequired: false,
    configFields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
    ],
  },
  // E-commerce
  ECOMMERCE_SHOPIFY: {
    type: 'ECOMMERCE_SHOPIFY',
    name: 'Shopify',
    description: 'E-commerce integration with Shopify stores',
    icon: '🛒',
    color: '#96bf48',
    category: 'CUSTOM',
    features: ['Order status', 'Product info', 'Customer data'],
    oauthRequired: true,
  },
  ECOMMERCE_WOOCOMMERCE: {
    type: 'ECOMMERCE_WOOCOMMERCE',
    name: 'WooCommerce',
    description: 'WordPress e-commerce integration',
    icon: '🛍️',
    color: '#96588a',
    category: 'CUSTOM',
    features: ['Order tracking', 'Products', 'Customers'],
    oauthRequired: false,
    configFields: [
      { key: 'siteUrl', label: 'Store URL', type: 'url', required: true },
      { key: 'consumerKey', label: 'Consumer Key', type: 'text', required: true },
      { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true },
    ],
  },
  // Email
  EMAIL_SENDGRID: {
    type: 'EMAIL_SENDGRID',
    name: 'SendGrid',
    description: 'Email delivery service',
    icon: '📧',
    color: '#1a82e2',
    category: 'CUSTOM',
    features: ['Send emails', 'Templates', 'Tracking'],
    oauthRequired: false,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
  EMAIL_MAILCHIMP: {
    type: 'EMAIL_MAILCHIMP',
    name: 'Mailchimp',
    description: 'Email marketing platform',
    icon: '🐵',
    color: '#ffe01b',
    category: 'CUSTOM',
    features: ['Add subscribers', 'Campaigns', 'Automations'],
    oauthRequired: true,
  },
  // Analytics
  ANALYTICS_GA4: {
    type: 'ANALYTICS_GA4',
    name: 'Google Analytics 4',
    description: 'Track events in Google Analytics',
    icon: '📈',
    color: '#f9ab00',
    category: 'CUSTOM',
    features: ['Track events', 'User properties', 'Conversions'],
    oauthRequired: false,
    configFields: [
      { key: 'measurementId', label: 'Measurement ID', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
    ],
  },
  // Custom
  CUSTOM_API: {
    type: 'CUSTOM_API',
    name: 'Custom API',
    description: 'Connect to any REST API',
    icon: '🔌',
    color: '#6b7280',
    category: 'CUSTOM',
    features: ['Any REST API', 'Custom headers', 'Authentication'],
    oauthRequired: false,
    configFields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'text', required: false },
      { key: 'authType', label: 'Auth Type', type: 'select', required: false, options: [
        { label: 'None', value: 'none' },
        { label: 'API Key', value: 'apiKey' },
        { label: 'Bearer Token', value: 'bearer' },
        { label: 'Basic Auth', value: 'basic' },
      ]},
    ],
  },
  WEBHOOK: {
    type: 'WEBHOOK',
    name: 'Webhook',
    description: 'Send/receive webhooks to any service',
    icon: '🪝',
    color: '#10b981',
    category: 'CUSTOM',
    features: ['Outgoing webhooks', 'Incoming webhooks', 'Event triggers'],
    oauthRequired: false,
    configFields: [
      { key: 'url', label: 'Webhook URL', type: 'url', required: true },
      { key: 'secret', label: 'Signing Secret', type: 'password', required: false, description: 'Used to verify webhook signatures' },
      { key: 'events', label: 'Events', type: 'multiselect', required: false, options: [
        { label: 'New Conversation', value: 'conversation.started' },
        { label: 'Message Received', value: 'message.received' },
        { label: 'Message Sent', value: 'message.sent' },
        { label: 'Handoff Requested', value: 'handoff.requested' },
        { label: 'Handoff Completed', value: 'handoff.completed' },
      ]},
    ],
  },
}
