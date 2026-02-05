#!/usr/bin/env npx tsx
/**
 * OpenAPI Schema Generator Script
 * 
 * Generates a static openapi.json file from the TypeScript schema definition.
 * This file can be used for:
 * - SDK generation (openapi-generator, orval, etc.)
 * - Importing into Postman/Insomnia
 * - CI/CD validation
 * - Static hosting
 * 
 * Usage:
 *   npx tsx scripts/generate-openapi.ts
 *   npm run openapi:generate
 * 
 * Options:
 *   --output, -o    Output file path (default: ./public/openapi.json)
 *   --pretty, -p    Pretty print JSON (default: true)
 *   --validate, -v  Validate the spec before writing (default: true)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

// Import the OpenAPI spec from our schema
import openApiSpec from '../src/lib/openapi/schema';

interface GeneratorOptions {
  output: string;
  pretty: boolean;
  validate: boolean;
}

function parseArgs(): GeneratorOptions {
  const args = process.argv.slice(2);
  const options: GeneratorOptions = {
    output: './public/openapi.json',
    pretty: true,
    validate: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--output':
      case '-o':
        if (next) {
          options.output = next;
          i++;
        }
        break;
      case '--pretty':
      case '-p':
        options.pretty = next !== 'false';
        break;
      case '--validate':
      case '-v':
        options.validate = next !== 'false';
        break;
      case '--help':
      case '-h':
        console.log(`
OpenAPI Schema Generator

Usage:
  npx tsx scripts/generate-openapi.ts [options]

Options:
  -o, --output <path>   Output file path (default: ./public/openapi.json)
  -p, --pretty          Pretty print JSON (default: true)
  -v, --validate        Validate spec before writing (default: true)
  -h, --help            Show this help message
        `);
        process.exit(0);
    }
  }

  return options;
}

function validateSpec(spec: typeof openApiSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic validation
  if (!spec.openapi) {
    errors.push('Missing "openapi" version field');
  } else if (!spec.openapi.startsWith('3.1')) {
    errors.push(`OpenAPI version should be 3.1.x, got ${spec.openapi}`);
  }

  if (!spec.info) {
    errors.push('Missing "info" object');
  } else {
    if (!spec.info.title) errors.push('Missing "info.title"');
    if (!spec.info.version) errors.push('Missing "info.version"');
  }

  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push('No paths defined');
  }

  // Validate paths
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!path.startsWith('/')) {
        errors.push(`Path "${path}" should start with /`);
      }

      // Check operations
      const operations = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
      for (const op of operations) {
        const operation = (pathItem as any)?.[op];
        if (operation) {
          if (!operation.responses) {
            errors.push(`${op.toUpperCase()} ${path}: Missing responses`);
          }
          if (!operation.operationId) {
            errors.push(`${op.toUpperCase()} ${path}: Missing operationId`);
          }
        }
      }
    }
  }

  // Validate component references
  const schemaRefs = new Set<string>();
  const definedSchemas = new Set(Object.keys(spec.components?.schemas || {}));
  
  function findRefs(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.$ref && typeof obj.$ref === 'string') {
      const match = obj.$ref.match(/#\/components\/schemas\/(\w+)/);
      if (match) schemaRefs.add(match[1]);
    }
    
    for (const value of Object.values(obj)) {
      findRefs(value);
    }
  }
  
  findRefs(spec.paths);
  findRefs(spec.components);

  for (const ref of schemaRefs) {
    if (!definedSchemas.has(ref)) {
      errors.push(`Referenced schema "${ref}" not found in components.schemas`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function generateStats(spec: typeof openApiSpec): void {
  const paths = Object.keys(spec.paths || {});
  const schemas = Object.keys(spec.components?.schemas || {});
  
  let operations = 0;
  const operationsByMethod: Record<string, number> = {};
  const tags = new Set<string>();

  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = (pathItem as any)?.[method];
      if (op) {
        operations++;
        operationsByMethod[method.toUpperCase()] = (operationsByMethod[method.toUpperCase()] || 0) + 1;
        op.tags?.forEach((tag: string) => tags.add(tag));
      }
    }
  }

  console.log('\n📊 OpenAPI Spec Statistics:');
  console.log(`   Version: ${spec.openapi}`);
  console.log(`   Title: ${spec.info?.title}`);
  console.log(`   API Version: ${spec.info?.version}`);
  console.log(`   Paths: ${paths.length}`);
  console.log(`   Operations: ${operations}`);
  console.log(`   Schemas: ${schemas.length}`);
  console.log(`   Tags: ${tags.size}`);
  console.log(`   Methods:`);
  for (const [method, count] of Object.entries(operationsByMethod).sort()) {
    console.log(`     ${method}: ${count}`);
  }
}

async function main() {
  const options = parseArgs();
  const startTime = Date.now();

  console.log('🚀 OpenAPI Schema Generator');
  console.log('━'.repeat(40));

  // Validate if requested
  if (options.validate) {
    console.log('\n🔍 Validating OpenAPI spec...');
    const { valid, errors } = validateSpec(openApiSpec);
    
    if (!valid) {
      console.error('\n❌ Validation failed:');
      errors.forEach(err => console.error(`   • ${err}`));
      process.exit(1);
    }
    
    console.log('   ✅ Spec is valid');
  }

  // Ensure output directory exists
  const outputPath = resolve(process.cwd(), options.output);
  const outputDir = dirname(outputPath);
  
  if (!existsSync(outputDir)) {
    console.log(`\n📁 Creating directory: ${outputDir}`);
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate JSON
  console.log(`\n📝 Generating ${options.output}...`);
  
  const json = options.pretty 
    ? JSON.stringify(openApiSpec, null, 2)
    : JSON.stringify(openApiSpec);

  writeFileSync(outputPath, json, 'utf-8');

  const sizeKb = (json.length / 1024).toFixed(2);
  console.log(`   ✅ Written ${sizeKb} KB`);

  // Show stats
  generateStats(openApiSpec);

  const duration = Date.now() - startTime;
  console.log(`\n✨ Done in ${duration}ms`);
  console.log(`\n📄 Output: ${outputPath}`);
  
  // Usage hints
  console.log('\n💡 Next steps:');
  console.log('   • View docs: npm run dev, then visit /api/docs/ui');
  console.log('   • Generate SDK: npx @openapitools/openapi-generator-cli generate -i public/openapi.json -g typescript-fetch -o sdk/');
  console.log('   • Import to Postman: Import public/openapi.json');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
