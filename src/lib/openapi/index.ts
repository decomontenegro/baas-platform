/**
 * OpenAPI Documentation Module
 * 
 * Exports the OpenAPI 3.1 specification for the BaaS Dashboard API.
 * 
 * Usage:
 *   import { openApiSpec } from '@/lib/openapi';
 *   import type { OpenAPIV3_1 } from 'openapi-types';
 */

export { openApiSpec, default } from './schema';

// Re-export types for convenience
export type { OpenAPIV3_1 } from 'openapi-types';

/**
 * Helper to get a specific schema from the spec
 */
export function getSchema(name: string) {
  const { openApiSpec } = require('./schema');
  return openApiSpec.components?.schemas?.[name];
}

/**
 * Helper to get all operation IDs
 */
export function getOperationIds(): string[] {
  const { openApiSpec } = require('./schema');
  const ids: string[] = [];
  
  for (const pathItem of Object.values(openApiSpec.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = (pathItem as any)?.[method];
      if (op?.operationId) {
        ids.push(op.operationId);
      }
    }
  }
  
  return ids;
}

/**
 * Helper to get all tags
 */
export function getTags(): string[] {
  const { openApiSpec } = require('./schema');
  return (openApiSpec.tags || []).map((t: any) => t.name);
}
