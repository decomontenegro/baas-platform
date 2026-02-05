/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * API Documentation UI
 * 
 * GET /api/docs/ui - Renders interactive API documentation using Scalar
 * 
 * Scalar is a modern, lightweight alternative to Swagger UI with:
 * - Beautiful design
 * - Dark/light mode
 * - Try-it-out functionality
 * - Code samples in multiple languages
 * - No external dependencies
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate the HTML for Scalar API documentation
 */
function generateScalarHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaaS Dashboard - API Documentation</title>
  <meta name="description" content="Interactive API documentation for BaaS Dashboard">
  
  <!-- Favicon -->
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>">
  
  <!-- Scalar Styles -->
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    
    /* Custom theme overrides */
    .scalar-app {
      --scalar-color-1: #6366f1; /* indigo-500 */
      --scalar-color-accent: #6366f1;
    }
    
    /* Loading state */
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 1.2rem;
    }
    
    .loading-spinner {
      animation: spin 1s linear infinite;
      margin-right: 12px;
      font-size: 24px;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <!-- Loading indicator -->
  <div id="loading" class="loading">
    <span class="loading-spinner">⚙️</span>
    Loading API Documentation...
  </div>

  <!-- Scalar container -->
  <div id="api-reference" style="display: none;"></div>

  <!-- Scalar Script (from CDN) -->
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  
  <script>
    // Wait for Scalar to load
    document.addEventListener('DOMContentLoaded', async () => {
      try {
        // Fetch the OpenAPI spec
        const response = await fetch('${specUrl}');
        if (!response.ok) throw new Error('Failed to load API spec');
        
        const spec = await response.json();
        
        // Hide loading, show docs
        document.getElementById('loading').style.display = 'none';
        document.getElementById('api-reference').style.display = 'block';
        
        // Initialize Scalar
        Scalar.createApiReference('#api-reference', {
          spec: {
            content: spec,
          },
          theme: 'purple',
          layout: 'modern',
          defaultHttpClient: {
            targetKey: 'javascript',
            clientKey: 'fetch',
          },
          hideModels: false,
          hideDownloadButton: false,
          hideTestRequestButton: false,
          darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
          showSidebar: true,
          searchHotKey: 'k',
          metaData: {
            title: 'BaaS Dashboard API',
            description: 'Bot-as-a-Service Platform API',
            ogDescription: 'Complete API documentation for BaaS Dashboard',
          },
          authentication: {
            preferredSecurityScheme: 'BearerAuth',
            http: {
              bearer: {
                token: '',
              },
            },
          },
        });
      } catch (error) {
        document.getElementById('loading').innerHTML = 
          '<div style="text-align: center;">' +
          '<div style="font-size: 48px; margin-bottom: 16px;">❌</div>' +
          '<div>Failed to load API documentation</div>' +
          '<div style="font-size: 14px; opacity: 0.8; margin-top: 8px;">' + error.message + '</div>' +
          '<button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer; border-radius: 8px; border: 2px solid white; background: transparent; color: white; font-size: 14px;">Retry</button>' +
          '</div>';
      }
    });
    
    // Handle dark mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Scalar will auto-update when recreated
    });
  </script>
</body>
</html>`;
}

/**
 * Alternative: Swagger UI HTML (if Scalar doesn't work)
 */
function generateSwaggerHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaaS Dashboard - API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .topbar { display: none !important; }
    .swagger-ui .info { margin: 30px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        docExpansion: 'list',
        filter: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai'
        }
      });
    };
  </script>
</body>
</html>`;
}

/**
 * GET /api/docs/ui
 * Renders the interactive API documentation
 */
export async function GET(request: NextRequest) {
  // Get the base URL for the spec
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const specUrl = `${protocol}://${host}/api/docs`;
  
  // Check query param for UI preference
  const searchParams = request.nextUrl.searchParams;
  const ui = searchParams.get('ui') || 'scalar';
  
  const html = ui === 'swagger' 
    ? generateSwaggerHtml(specUrl)
    : generateScalarHtml(specUrl);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
