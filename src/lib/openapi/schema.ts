/**
 * OpenAPI 3.1 Schema for BaaS Dashboard API
 * 
 * This file defines the complete API specification for all endpoints
 * in the BaaS Dashboard, including request/response schemas, security,
 * and examples.
 */

import type { OpenAPIV3_1 } from 'openapi-types';

// Type to allow OpenAPI 3.1 features like nullable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaObject = Record<string, any>;

// ============================================================================
// COMPONENT SCHEMAS
// ============================================================================

const schemas: Record<string, SchemaObject> = {
  // ----- Error Schemas -----
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', description: 'Human-readable error message' },
          code: { type: 'string', description: 'Machine-readable error code' },
          details: {
            oneOf: [
              { type: 'array', items: { type: 'object' } },
              { type: 'object' },
              { type: 'string' },
            ],
            description: 'Additional error details',
          },
        },
      },
    },
    example: {
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: [{ path: 'name', message: 'Required' }],
      },
    },
  },

  ValidationError: {
    allOf: [
      { $ref: '#/components/schemas/Error' },
      {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },

  // ----- Pagination -----
  Pagination: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer', minimum: 1, description: 'Current page number' },
      limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Items per page' },
      total: { type: 'integer', minimum: 0, description: 'Total number of items' },
      totalPages: { type: 'integer', minimum: 0, description: 'Total number of pages' },
    },
    example: { page: 1, limit: 20, total: 45, totalPages: 3 },
  },

  // ----- Tenant Schemas -----
  Tenant: {
    type: 'object',
    required: ['id', 'name', 'slug', 'plan', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'cuid', description: 'Unique tenant identifier' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
      plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
      settings: { type: 'object', additionalProperties: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      _count: {
        type: 'object',
        properties: {
          memberships: { type: 'integer' },
          workspaces: { type: 'integer' },
        },
      },
    },
    example: {
      id: 'clx123abc',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      plan: 'pro',
      settings: { timezone: 'America/Sao_Paulo' },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:45:00Z',
      _count: { memberships: 5, workspaces: 3 },
    },
  },

  UpdateTenantInput: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      settings: { type: 'object', additionalProperties: true },
    },
    example: { name: 'New Company Name', settings: { language: 'pt-BR' } },
  },

  // ----- Workspace Schemas -----
  Workspace: {
    type: 'object',
    required: ['id', 'name', 'tenantId', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'cuid' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500, nullable: true },
      tenantId: { type: 'string', format: 'cuid' },
      settings: { type: 'object', additionalProperties: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      _count: {
        type: 'object',
        properties: {
          channels: { type: 'integer' },
        },
      },
    },
    example: {
      id: 'clx456def',
      name: 'Marketing Bot',
      description: 'Bot for marketing campaigns',
      tenantId: 'clx123abc',
      settings: { defaultLanguage: 'pt-BR' },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:45:00Z',
      _count: { channels: 2 },
    },
  },

  CreateWorkspaceInput: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      settings: { type: 'object', additionalProperties: true },
    },
    example: { name: 'Sales Bot', description: 'Bot for sales team' },
  },

  UpdateWorkspaceInput: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500, nullable: true },
      settings: { type: 'object', additionalProperties: true },
    },
  },

  // ----- Channel Schemas -----
  ChannelType: {
    type: 'string',
    enum: ['WHATSAPP', 'TELEGRAM', 'DISCORD', 'SLACK', 'WEBCHAT', 'API'],
    description: 'Supported channel types',
  },

  ChannelStatus: {
    type: 'string',
    enum: ['ACTIVE', 'INACTIVE', 'ERROR', 'CONNECTING'],
    description: 'Channel connection status',
  },

  Channel: {
    type: 'object',
    required: ['id', 'name', 'type', 'status', 'workspaceId', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'cuid' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      type: { $ref: '#/components/schemas/ChannelType' },
      status: { $ref: '#/components/schemas/ChannelStatus' },
      workspaceId: { type: 'string', format: 'cuid' },
      workspace: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
      config: { type: 'object', additionalProperties: true },
      metadata: { type: 'object', additionalProperties: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    example: {
      id: 'clx789ghi',
      name: 'WhatsApp Support',
      type: 'WHATSAPP',
      status: 'ACTIVE',
      workspaceId: 'clx456def',
      workspace: { id: 'clx456def', name: 'Marketing Bot' },
      config: { phoneNumber: '+5511999999999' },
      metadata: { connectedAt: '2024-01-15T10:30:00Z' },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:45:00Z',
    },
  },

  CreateChannelInput: {
    type: 'object',
    required: ['name', 'type', 'workspaceId'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      type: { $ref: '#/components/schemas/ChannelType' },
      workspaceId: { type: 'string', format: 'cuid' },
      config: { type: 'object', additionalProperties: true },
      metadata: { type: 'object', additionalProperties: true },
    },
    example: { name: 'Telegram Sales', type: 'TELEGRAM', workspaceId: 'clx456def' },
  },

  UpdateChannelInput: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      status: { $ref: '#/components/schemas/ChannelStatus' },
      config: { type: 'object', additionalProperties: true },
      metadata: { type: 'object', additionalProperties: true },
    },
  },

  TestChannelInput: {
    type: 'object',
    required: ['message'],
    properties: {
      message: { type: 'string', minLength: 1, maxLength: 1000, description: 'Test message to send' },
    },
    example: { message: 'Hello, this is a test message!' },
  },

  TestChannelResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      channel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string' },
        },
      },
      test: {
        type: 'object',
        properties: {
          input: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          output: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              processingTimeMs: { type: 'integer' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          metadata: { type: 'object' },
        },
      },
    },
  },

  // ----- Personality Schemas -----
  PersonalityTone: {
    type: 'string',
    enum: ['professional', 'friendly', 'casual', 'formal', 'technical'],
    description: 'The tone/style of the bot personality',
  },

  Personality: {
    type: 'object',
    required: ['id', 'name', 'systemPrompt', 'tone', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
      systemPrompt: { type: 'string', description: 'The system prompt that defines bot behavior' },
      tone: { $ref: '#/components/schemas/PersonalityTone' },
      language: { type: 'string', default: 'pt-BR' },
      isTemplate: { type: 'boolean', description: 'Whether this is a system template' },
      isCustom: { type: 'boolean', description: 'Whether this is a custom personality' },
      organizationId: { type: 'string', nullable: true },
      metadata: { type: 'object', additionalProperties: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    example: {
      id: 'pers_abc123',
      name: 'Support Agent',
      description: 'Friendly and helpful support agent',
      systemPrompt: 'You are a helpful customer support agent...',
      tone: 'friendly',
      language: 'pt-BR',
      isTemplate: false,
      isCustom: true,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:45:00Z',
    },
  },

  CreatePersonalityInput: {
    type: 'object',
    required: ['name', 'systemPrompt', 'tone'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
      systemPrompt: { type: 'string', minLength: 1 },
      tone: { $ref: '#/components/schemas/PersonalityTone' },
      language: { type: 'string', default: 'pt-BR' },
      metadata: { type: 'object', additionalProperties: true },
    },
  },

  UpdatePersonalityInput: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
      systemPrompt: { type: 'string', minLength: 1 },
      tone: { $ref: '#/components/schemas/PersonalityTone' },
      language: { type: 'string' },
      metadata: { type: 'object', additionalProperties: true },
    },
  },

  PersonalityPreviewInput: {
    type: 'object',
    required: ['message'],
    properties: {
      message: { type: 'string', minLength: 1, description: 'Message to test the personality with' },
    },
    example: { message: 'Olá, preciso de ajuda com meu pedido' },
  },

  PersonalityPreviewResponse: {
    type: 'object',
    properties: {
      response: { type: 'string', description: 'Generated response' },
      personality: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tone: { type: 'string' },
        },
      },
      tokensUsed: { type: 'integer' },
      latencyMs: { type: 'integer' },
    },
  },

  // ----- Specialist Schemas -----
  Specialist: {
    type: 'object',
    required: ['id', 'name', 'expertise', 'systemPrompt', 'model', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
      expertise: { type: 'array', items: { type: 'string' }, minItems: 1 },
      systemPrompt: { type: 'string' },
      model: {
        type: 'string',
        enum: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      },
      maxTokens: { type: 'integer', minimum: 1, maximum: 32000, default: 2048 },
      temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
      isTemplate: { type: 'boolean' },
      isCustom: { type: 'boolean' },
      organizationId: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  CreateSpecialistInput: {
    type: 'object',
    required: ['name', 'systemPrompt', 'expertise'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
      expertise: { type: 'array', items: { type: 'string' }, minItems: 1 },
      systemPrompt: { type: 'string', minLength: 1 },
      model: { type: 'string' },
      maxTokens: { type: 'integer', minimum: 1, maximum: 32000 },
      temperature: { type: 'number', minimum: 0, maximum: 2 },
    },
  },

  // ----- Feature Schemas -----
  FeatureTier: {
    type: 'string',
    enum: ['free', 'pro', 'enterprise'],
  },

  Feature: {
    type: 'object',
    required: ['key', 'name', 'category', 'tier', 'enabled'],
    properties: {
      key: { type: 'string', description: 'Unique feature identifier' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      tier: { $ref: '#/components/schemas/FeatureTier' },
      enabled: { type: 'boolean' },
      config: { type: 'object', additionalProperties: true },
    },
  },

  FeatureUpdateInput: {
    type: 'object',
    required: ['key', 'enabled'],
    properties: {
      key: { type: 'string' },
      enabled: { type: 'boolean' },
      config: { type: 'object', additionalProperties: true },
    },
  },

  FeaturesResponse: {
    type: 'object',
    properties: {
      features: { type: 'array', items: { $ref: '#/components/schemas/Feature' } },
      grouped: {
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: { $ref: '#/components/schemas/Feature' },
        },
      },
      summary: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          enabled: { type: 'integer' },
          disabled: { type: 'integer' },
        },
      },
    },
  },

  // ----- Billing Schemas -----
  BillingPlan: {
    type: 'object',
    properties: {
      tier: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
      name: { type: 'string' },
      price: { type: 'number' },
      currency: { type: 'string' },
      billingPeriod: { type: 'string', enum: ['monthly', 'yearly'] },
    },
  },

  BillingUsage: {
    type: 'object',
    properties: {
      messages: {
        type: 'object',
        properties: {
          used: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
      aiTokens: {
        type: 'object',
        properties: {
          used: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
      storage: {
        type: 'object',
        properties: {
          usedBytes: { type: 'integer' },
          limitBytes: { type: 'integer' },
        },
      },
    },
  },

  BillingResponse: {
    type: 'object',
    properties: {
      organizationId: { type: 'string' },
      plan: { $ref: '#/components/schemas/BillingPlan' },
      credits: {
        type: 'object',
        properties: {
          used: { type: 'number' },
          total: { type: 'number' },
          resetDate: { type: 'string', format: 'date-time' },
        },
      },
      usage: { $ref: '#/components/schemas/BillingUsage' },
      formatted: { type: 'object' },
      percentages: { type: 'object' },
      warnings: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
  },

  // ----- Analytics Schemas -----
  AnalyticsOverview: {
    type: 'object',
    properties: {
      organizationId: { type: 'string' },
      period: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' },
        },
      },
      metrics: {
        type: 'object',
        properties: {
          totalMessages: { type: 'integer' },
          totalResponses: { type: 'integer' },
          averageResponseTime: { type: 'number' },
          activeChannels: { type: 'integer' },
          tokensUsed: { type: 'integer' },
          estimatedCost: { type: 'number' },
        },
      },
      trends: { type: 'object' },
      generatedAt: { type: 'string', format: 'date-time' },
    },
  },

  UsageReportGranularity: {
    type: 'string',
    enum: ['hour', 'day', 'week', 'month'],
  },

  UsageReport: {
    type: 'object',
    properties: {
      organizationId: { type: 'string' },
      period: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' },
        },
      },
      granularity: { $ref: '#/components/schemas/UsageReportGranularity' },
      dataPoints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            messages: { type: 'integer' },
            tokens: { type: 'integer' },
            cost: { type: 'number' },
          },
        },
      },
      summary: { type: 'object' },
      exportFormats: { type: 'array', items: { type: 'string' } },
      generatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // ----- Clawdbot Schemas -----
  WhatsAppGroup: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'WhatsApp group ID' },
      name: { type: 'string' },
      description: { type: 'string' },
      participants: { type: 'integer' },
      isAdmin: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  GroupConfig: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      personality: { type: 'string' },
      systemPrompt: { type: 'string' },
      rateLimit: {
        type: 'object',
        properties: {
          maxMessages: { type: 'integer' },
          windowSeconds: { type: 'integer' },
        },
      },
      features: {
        type: 'object',
        additionalProperties: { type: 'boolean' },
      },
    },
  },

  SyncResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      created: { type: 'integer' },
      updated: { type: 'integer' },
      deleted: { type: 'integer' },
      unchanged: { type: 'integer' },
      errors: { type: 'array', items: { type: 'string' } },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },

  WebhookEvent: {
    type: 'object',
    required: ['type', 'timestamp'],
    properties: {
      type: {
        type: 'string',
        enum: ['message.received', 'message.sent', 'group.joined', 'group.left', 'status.change', 'agent.response'],
      },
      timestamp: { type: 'integer', description: 'Unix timestamp in milliseconds' },
    },
    discriminator: {
      propertyName: 'type',
    },
  },
};

// ============================================================================
// SECURITY SCHEMES
// ============================================================================

const securitySchemes: Record<string, SchemaObject> = {
  BearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT token from NextAuth session',
  },
  ApiKeyAuth: {
    type: 'apiKey',
    in: 'header',
    name: 'Authorization',
    description: 'API key for external integrations',
  },
};

// ============================================================================
// RESPONSE DEFINITIONS
// ============================================================================

const responses: Record<string, SchemaObject> = {
  Unauthorized: {
    description: 'Authentication required',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      },
    },
  },
  Forbidden: {
    description: 'Insufficient permissions',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { error: { message: 'Forbidden', code: 'FORBIDDEN' } },
      },
    },
  },
  NotFound: {
    description: 'Resource not found',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { error: { message: 'Resource not found', code: 'NOT_FOUND' } },
      },
    },
  },
  BadRequest: {
    description: 'Invalid request',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ValidationError' },
      },
    },
  },
  TooManyRequests: {
    description: 'Rate limit exceeded',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { error: { message: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' } },
      },
    },
    headers: {
      'Retry-After': {
        description: 'Seconds to wait before retrying',
        schema: { type: 'integer' },
      },
      'X-RateLimit-Limit': {
        description: 'Request limit per window',
        schema: { type: 'integer' },
      },
      'X-RateLimit-Remaining': {
        description: 'Remaining requests in window',
        schema: { type: 'integer' },
      },
    },
  },
  InternalError: {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      },
    },
  },
};

// ============================================================================
// PATH DEFINITIONS
// ============================================================================

const paths: Record<string, SchemaObject> = {
  // ----- Tenants -----
  '/api/tenants': {
    get: {
      tags: ['Tenants'],
      summary: 'Get current tenant',
      description: 'Returns the tenant information for the authenticated user',
      operationId: 'getTenant',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Tenant details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tenant: { $ref: '#/components/schemas/Tenant' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Tenants'],
      summary: 'Update tenant settings',
      description: 'Updates tenant name and/or settings. Requires owner or admin role.',
      operationId: 'updateTenant',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateTenantInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated tenant',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tenant: { $ref: '#/components/schemas/Tenant' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ----- Workspaces -----
  '/api/workspaces': {
    get: {
      tags: ['Workspaces'],
      summary: 'List workspaces',
      description: 'Returns paginated list of workspaces for the current tenant',
      operationId: 'listWorkspaces',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        '200': {
          description: 'List of workspaces',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workspaces: { type: 'array', items: { $ref: '#/components/schemas/Workspace' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    post: {
      tags: ['Workspaces'],
      summary: 'Create workspace',
      description: 'Creates a new workspace in the current tenant',
      operationId: 'createWorkspace',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateWorkspaceInput' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created workspace',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workspace: { $ref: '#/components/schemas/Workspace' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/workspaces/{id}': {
    get: {
      tags: ['Workspaces'],
      summary: 'Get workspace',
      description: 'Returns details of a specific workspace',
      operationId: 'getWorkspace',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      responses: {
        '200': {
          description: 'Workspace details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workspace: { $ref: '#/components/schemas/Workspace' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Workspaces'],
      summary: 'Update workspace',
      description: 'Updates a workspace',
      operationId: 'updateWorkspace',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateWorkspaceInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated workspace',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workspace: { $ref: '#/components/schemas/Workspace' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Workspaces'],
      summary: 'Delete workspace',
      description: 'Deletes a workspace and all its channels',
      operationId: 'deleteWorkspace',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      responses: {
        '204': { description: 'Workspace deleted' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ----- Channels -----
  '/api/channels': {
    get: {
      tags: ['Channels'],
      summary: 'List channels',
      description: 'Returns paginated list of channels with optional filters',
      operationId: 'listChannels',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'workspaceId', in: 'query', schema: { type: 'string', format: 'cuid' } },
        { name: 'type', in: 'query', schema: { $ref: '#/components/schemas/ChannelType' } },
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ChannelStatus' } },
      ],
      responses: {
        '200': {
          description: 'List of channels',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  channels: { type: 'array', items: { $ref: '#/components/schemas/Channel' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                  filters: {
                    type: 'object',
                    properties: {
                      workspaceId: { type: 'string', nullable: true },
                      type: { type: 'string', nullable: true },
                      status: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Channels'],
      summary: 'Create channel',
      description: 'Creates a new channel in a workspace',
      operationId: 'createChannel',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateChannelInput' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Created channel',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  channel: { $ref: '#/components/schemas/Channel' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/channels/{id}': {
    get: {
      tags: ['Channels'],
      summary: 'Get channel',
      description: 'Returns details of a specific channel',
      operationId: 'getChannel',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      responses: {
        '200': {
          description: 'Channel details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  channel: { $ref: '#/components/schemas/Channel' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Channels'],
      summary: 'Update channel',
      description: 'Updates channel properties',
      operationId: 'updateChannel',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateChannelInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated channel',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  channel: { $ref: '#/components/schemas/Channel' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Channels'],
      summary: 'Delete channel',
      description: 'Deletes a channel',
      operationId: 'deleteChannel',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      responses: {
        '204': { description: 'Channel deleted' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/channels/{id}/test': {
    post: {
      tags: ['Channels'],
      summary: 'Test channel',
      description: 'Sends a test message through the channel to verify bot functionality',
      operationId: 'testChannel',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TestChannelInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Test result',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TestChannelResponse' },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ----- Personalities -----
  '/api/personalities': {
    get: {
      tags: ['Personalities'],
      summary: 'List personalities',
      description: 'Returns paginated list of personality templates and custom personalities',
      operationId: 'listPersonalities',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'template', 'custom'], default: 'all' } },
      ],
      responses: {
        '200': {
          description: 'List of personalities',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Personality' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Personalities'],
      summary: 'Create personality',
      description: 'Creates a new custom personality',
      operationId: 'createPersonality',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreatePersonalityInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Created personality',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Personality' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/personalities/{id}': {
    get: {
      tags: ['Personalities'],
      summary: 'Get personality',
      description: 'Returns details of a specific personality',
      operationId: 'getPersonality',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Personality details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Personality' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Personalities'],
      summary: 'Update personality',
      description: 'Updates a custom personality (templates cannot be edited)',
      operationId: 'updatePersonality',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdatePersonalityInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated personality',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Personality' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Personalities'],
      summary: 'Delete personality',
      description: 'Deletes a custom personality (templates cannot be deleted)',
      operationId: 'deletePersonality',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Personality deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'object', properties: { id: { type: 'string' } } },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/personalities/{id}/preview': {
    post: {
      tags: ['Personalities'],
      summary: 'Preview personality',
      description: 'Tests the personality with a sample message to see how it would respond',
      operationId: 'previewPersonality',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PersonalityPreviewInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Preview response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/PersonalityPreviewResponse' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ----- Specialists -----
  '/api/specialists': {
    get: {
      tags: ['Specialists'],
      summary: 'List specialists',
      description: 'Returns paginated list of AI specialists with optional filters',
      operationId: 'listSpecialists',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'template', 'custom'], default: 'all' } },
        { name: 'expertise', in: 'query', schema: { type: 'string' }, description: 'Filter by expertise keyword' },
      ],
      responses: {
        '200': {
          description: 'List of specialists',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Specialist' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Specialists'],
      summary: 'Create specialist',
      description: 'Creates a new custom AI specialist',
      operationId: 'createSpecialist',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateSpecialistInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Created specialist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Specialist' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  // ----- Features -----
  '/api/features': {
    get: {
      tags: ['Features'],
      summary: 'List features',
      description: 'Returns all feature flags with their current status for the organization',
      operationId: 'listFeatures',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
        { name: 'tier', in: 'query', schema: { $ref: '#/components/schemas/FeatureTier' } },
      ],
      responses: {
        '200': {
          description: 'Feature list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/FeaturesResponse' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    patch: {
      tags: ['Features'],
      summary: 'Update features',
      description: 'Bulk update feature flags (enable/disable). Some features require plan upgrade.',
      operationId: 'updateFeatures',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['updates'],
              properties: {
                updates: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/FeatureUpdateInput' },
                  minItems: 1,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated features',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/FeaturesResponse' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },

  // ----- Billing -----
  '/api/billing': {
    get: {
      tags: ['Billing'],
      summary: 'Get billing status',
      description: 'Returns current plan, credits, usage metrics, and recommendations',
      operationId: 'getBillingStatus',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Billing information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BillingResponse' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  // ----- Analytics -----
  '/api/analytics/overview': {
    get: {
      tags: ['Analytics'],
      summary: 'Get analytics overview',
      description: 'Returns high-level metrics for the dashboard (messages, channels, costs)',
      operationId: 'getAnalyticsOverview',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'start',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          description: 'Start date (ISO format)',
        },
        {
          name: 'end',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          description: 'End date (ISO format)',
        },
      ],
      responses: {
        '200': {
          description: 'Analytics overview',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/AnalyticsOverview' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/api/analytics/usage': {
    get: {
      tags: ['Analytics'],
      summary: 'Get usage report',
      description: 'Returns detailed usage data over time with configurable granularity',
      operationId: 'getUsageReport',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'start',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          description: 'Start date (ISO format)',
        },
        {
          name: 'end',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          description: 'End date (ISO format)',
        },
        {
          name: 'granularity',
          in: 'query',
          schema: { $ref: '#/components/schemas/UsageReportGranularity' },
          description: 'Time granularity for data points',
        },
      ],
      responses: {
        '200': {
          description: 'Usage report',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/UsageReport' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  // ----- Clawdbot -----
  '/api/clawdbot/groups': {
    get: {
      tags: ['Clawdbot'],
      summary: 'List WhatsApp groups',
      description: 'Returns all WhatsApp groups from the connected Clawdbot Gateway',
      operationId: 'listClawdbotGroups',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'includeLocal',
          in: 'query',
          schema: { type: 'boolean', default: false },
          description: 'Include local database information',
        },
      ],
      responses: {
        '200': {
          description: 'List of groups',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/WhatsAppGroup' } },
                  meta: { type: 'object', properties: { total: { type: 'integer' } } },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '503': {
          description: 'Gateway unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Clawdbot'],
      summary: 'Sync groups',
      description: 'Synchronizes WhatsApp groups from Clawdbot Gateway with local database',
      operationId: 'syncClawdbotGroups',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                dryRun: { type: 'boolean', default: false, description: 'Preview changes without applying' },
                forceUpdate: { type: 'boolean', default: false, description: 'Force update all groups' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Sync result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/SyncResult' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '503': {
          description: 'Gateway unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },

  '/api/clawdbot/groups/{id}/config': {
    get: {
      tags: ['Clawdbot'],
      summary: 'Get group config',
      description: 'Returns the current configuration for a specific WhatsApp group',
      operationId: 'getClawdbotGroupConfig',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'WhatsApp group ID' },
        {
          name: 'mergeLocal',
          in: 'query',
          schema: { type: 'boolean', default: true },
          description: 'Merge with local config',
        },
      ],
      responses: {
        '200': {
          description: 'Group configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/GroupConfig' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '503': {
          description: 'Gateway unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    patch: {
      tags: ['Clawdbot'],
      summary: 'Update group config',
      description: 'Partially updates the configuration for a WhatsApp group',
      operationId: 'updateClawdbotGroupConfig',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'WhatsApp group ID' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GroupConfig' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/GroupConfig' },
                  meta: { type: 'object', properties: { warnings: { type: 'array', items: { type: 'string' } } } },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '503': {
          description: 'Gateway unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    put: {
      tags: ['Clawdbot'],
      summary: 'Replace group config',
      description: 'Replaces the entire configuration for a WhatsApp group',
      operationId: 'replaceClawdbotGroupConfig',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'WhatsApp group ID' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GroupConfig' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Replaced configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/GroupConfig' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '503': {
          description: 'Gateway unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },

  '/api/clawdbot/webhook': {
    get: {
      tags: ['Clawdbot'],
      summary: 'Webhook health check',
      description: 'Returns webhook service status',
      operationId: 'getClawdbotWebhookStatus',
      responses: {
        '200': {
          description: 'Service status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok'] },
                  service: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Clawdbot'],
      summary: 'Receive webhook event',
      description: 'Receives events from Clawdbot Gateway (messages, status changes, etc.)',
      operationId: 'receiveClawdbotWebhook',
      parameters: [
        {
          name: 'x-clawdbot-signature',
          in: 'header',
          schema: { type: 'string' },
          description: 'HMAC-SHA256 signature for payload verification',
        },
        {
          name: 'x-organization-id',
          in: 'header',
          schema: { type: 'string' },
          description: 'Organization identifier',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookEvent' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Event received',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'object', properties: { received: { type: 'boolean' } } },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '500': { $ref: '#/components/responses/InternalError' },
      },
    },
  },
};

// ============================================================================
// TAGS
// ============================================================================

const tags: SchemaObject[] = [
  { name: 'Tenants', description: 'Tenant (organization) management' },
  { name: 'Workspaces', description: 'Workspace management for organizing bots and channels' },
  { name: 'Channels', description: 'Communication channel management (WhatsApp, Telegram, etc.)' },
  { name: 'Personalities', description: 'Bot personality templates and customization' },
  { name: 'Specialists', description: 'AI specialist agents with specific expertise' },
  { name: 'Features', description: 'Feature flags and tier-based capabilities' },
  { name: 'Billing', description: 'Billing, credits, and usage limits' },
  { name: 'Analytics', description: 'Usage analytics and reporting' },
  { name: 'Clawdbot', description: 'Clawdbot Gateway integration for WhatsApp' },
];

// ============================================================================
// COMPLETE OPENAPI SPECIFICATION
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openApiSpec: any = {
  openapi: '3.1.0',
  info: {
    title: 'BaaS Dashboard API',
    description: `
# Bot-as-a-Service Dashboard API

API completa para gerenciamento de bots conversacionais multi-canal.

## Autenticação

Todas as rotas requerem autenticação via JWT (NextAuth) ou API Key.

\`\`\`
Authorization: Bearer <token>
\`\`\`

## Rate Limiting

- **Free tier**: 100 requests/minute
- **Pro tier**: 1000 requests/minute  
- **Enterprise**: Custom limits

Headers de resposta incluem:
- \`X-RateLimit-Limit\`: Limite de requests
- \`X-RateLimit-Remaining\`: Requests restantes
- \`Retry-After\`: Segundos para retry (quando limitado)

## Errors

Todos os erros seguem o formato:

\`\`\`json
{
  "error": {
    "message": "Human-readable message",
    "code": "MACHINE_CODE",
    "details": {}
  }
}
\`\`\`

## Paginação

Endpoints que retornam listas suportam paginação:

- \`page\`: Número da página (1-indexed)
- \`limit\`: Itens por página (max 100)

Resposta inclui objeto \`pagination\`:

\`\`\`json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
\`\`\`
    `,
    version: '1.0.0',
    contact: {
      name: 'BaaS Support',
      email: 'support@baas.example.com',
      url: 'https://baas.example.com/docs',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://app.baas.example.com',
      description: 'Production server',
    },
  ],
  tags,
  paths,
  components: {
    schemas,
    securitySchemes,
    responses,
  },
  security: [{ BearerAuth: [] }],
};

export default openApiSpec;
