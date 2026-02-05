/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * OpenAPI Documentation Endpoint
 * 
 * GET /api/docs - Returns the OpenAPI 3.1 specification as JSON
 * 
 * Can be used to:
 * - Feed to Swagger UI, Scalar, or other documentation tools
 * - Generate client SDKs (openapi-generator, etc.)
 * - Import into API testing tools (Postman, Insomnia)
 */

import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';

/**
 * GET /api/docs
 * Returns the complete OpenAPI specification
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*', // Allow CORS for docs
    },
  });
}

/**
 * OPTIONS /api/docs
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
