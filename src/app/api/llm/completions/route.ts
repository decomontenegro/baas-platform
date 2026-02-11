/**
 * LLM Gateway API - Completions Endpoint
 * POST /api/llm/completions
 * 
 * Processa requests de completion através do gateway centralizado
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { complete, RateLimitError, ProviderUnavailableError } from '@/lib/llm-gateway';
import type { Message, GatewayOptions } from '@/lib/llm-gateway';

// ============================================
// Types
// ============================================

interface CompletionRequestBody {
  tenant_id?: string;
  agent_id?: string;
  model?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  
  // Metadata for tracking
  channel?: string;
  group_id?: string;
  session_id?: string;
}

// ============================================
// POST /api/llm/completions
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request
    const body: CompletionRequestBody = await request.json();
    
    // 2. Authenticate
    const auth = await authenticateRequest(request, body.tenant_id);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }
    
    const tenantId = auth.tenantId!;
    
    // 3. Validate messages
    if (!body.Message || !Array.isArray(body.Message) || body.Message.length === 0) {
      return NextResponse.json(
        { error: 'messages is required and must be a non-empty array' },
        { status: 400 }
      );
    }
    
    // 4. Validate agent (if provided)
    let agentId: string | undefined;
    if (body.agent_id) {
      const agent = await prisma.tenantAgent.findFirst({
        where: {
          id: body.agent_id,
          tenantId
        }
      });
      
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found or does not belong to tenant' },
          { status: 404 }
        );
      }
      
      agentId = agent.id;
    }
    
    // 5. Build options
    const options: GatewayOptions = {};
    if (body.model) options.model = body.model;
    if (body.max_tokens) options.maxTokens = body.max_tokens;
    if (body.temperature !== undefined) options.temperature = body.temperature;
    
    // 6. Execute completion
    const response = await complete(
      {
        tenantId,
        agentId,
        messages: body.Message as Message[],
        channel: body.Channel,
        groupId: body.group_id,
        sessionId: body.session_id
      },
      options
    );
    
    // 7. Return response
    return NextResponse.json({
      id: response.id,
      model: response.model,
      provider: response.provider,
      content: response.content,
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        cost: response.usage.cost
      },
      latency_ms: response.latencyMs
    });
    
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// Authentication
// ============================================

interface AuthResult {
  authenticated: boolean;
  tenantId?: string;
  error?: string;
}

async function authenticateRequest(
  request: NextRequest,
  bodyTenantId?: string
): Promise<AuthResult> {
  // 1. Check API key in header
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    const result = await authenticateApiKey(apiKey);
    if (result.authenticated) {
      return result;
    }
  }
  
  // 2. Check Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const result = await authenticateApiKey(token);
    if (result.authenticated) {
      return result;
    }
  }
  
  // 3. Check session (for dashboard users)
  const session = await getServerSession();
  if (session?.user) {
    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { Tenant: true }
    });
    
    if (user?.tenantId) {
      // If tenant_id provided in body, verify it matches
      if (bodyTenantId && bodyTenantId !== user.tenantId) {
        return {
          authenticated: false,
          error: 'tenant_id does not match user tenant'
        };
      }
      
      return {
        authenticated: true,
        tenantId: user.tenantId
      };
    }
  }
  
  return {
    authenticated: false,
    error: 'Authentication required. Provide API key or session.'
  };
}

async function authenticateApiKey(key: string): Promise<AuthResult> {
  // Hash the key to compare with stored hash
  const crypto = await import('crypto');
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
      deletedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }
  });
  
  if (!apiKey) {
    return {
      authenticated: false,
      error: 'Invalid or expired API key'
    };
  }
  
  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });
  
  return {
    authenticated: true,
    tenantId: apiKey.tenantId
  };
}

// ============================================
// Error Handling
// ============================================

function handleError(error: unknown): NextResponse {
  console.error('[LLM API] Error:', error);
  
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        retry_after: error.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(error.retryAfter)
        }
      }
    );
  }
  
  if (error instanceof ProviderUnavailableError) {
    return NextResponse.json(
      { error: error.message },
      { status: 503 }
    );
  }
  
  if (error instanceof Error) {
    // Don't expose internal errors in production
    const message = process.env.NODE_ENV === 'development'
      ? error.message
      : 'Internal server error';
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'Unknown error occurred' },
    { status: 500 }
  );
}

// ============================================
// OPTIONS (CORS)
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Max-Age': '86400'
    }
  });
}
