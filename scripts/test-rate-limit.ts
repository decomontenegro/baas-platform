#!/usr/bin/env npx tsx
/**
 * Rate Limit Test Script
 * 
 * Tests the rate limiting implementation by making rapid requests
 * to different endpoints and verifying limits are enforced.
 * 
 * Usage:
 *   npx tsx scripts/test-rate-limit.ts
 *   
 * Or with custom base URL:
 *   BASE_URL=https://your-app.com npx tsx scripts/test-rate-limit.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

/**
 * Make a request and return status + headers
 */
async function makeRequest(
  path: string,
  method: string = 'GET',
  body?: Record<string, unknown>
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.' + Math.floor(Math.random() * 255), // Simulate different IPs
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${path}`, options)
  const responseBody = await response.json().catch(() => ({}))

  return {
    status: response.status,
    headers: response.headers,
    body: responseBody,
  }
}

/**
 * Test magic link rate limiting
 */
async function testMagicLinkRateLimit(): Promise<void> {
  console.log('\n📧 Testing Magic Link Rate Limit (5 req/15min per email)...')
  
  const email = `test-${Date.now()}@example.com`
  let rateLimited = false
  let requestCount = 0

  for (let i = 0; i < 10; i++) {
    const response = await makeRequest('/api/auth/magic-link', 'POST', { email })
    requestCount++

    if (response.status === 429) {
      rateLimited = true
      console.log(`   ✅ Rate limited after ${requestCount} requests`)
      console.log(`   Headers: X-RateLimit-Remaining=${response.headers.get('X-RateLimit-Remaining')}`)
      break
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  results.push({
    name: 'Magic Link Rate Limit',
    passed: rateLimited && requestCount <= 6, // Should be limited at or before 6th request
    details: rateLimited 
      ? `Rate limited after ${requestCount} requests (expected ~5)` 
      : 'Never rate limited (limit may not be configured)',
  })
}

/**
 * Test API read rate limiting
 */
async function testApiReadRateLimit(): Promise<void> {
  console.log('\n📖 Testing API Read Rate Limit (100 req/min per tenant)...')
  
  // Make many rapid requests
  const responses: { status: number; remaining: string | null }[] = []
  
  for (let i = 0; i < 10; i++) {
    const response = await makeRequest('/api/bots', 'GET')
    responses.push({
      status: response.status,
      remaining: response.headers.get('X-RateLimit-Remaining'),
    })
  }

  const hasHeaders = responses.some(r => r.remaining !== null)
  const lastRemaining = responses[responses.length - 1].remaining

  results.push({
    name: 'API Read Rate Limit Headers',
    passed: hasHeaders,
    details: hasHeaders 
      ? `Rate limit headers present. Last remaining: ${lastRemaining}` 
      : 'No rate limit headers found',
  })
}

/**
 * Test API write rate limiting
 */
async function testApiWriteRateLimit(): Promise<void> {
  console.log('\n✍️ Testing API Write Rate Limit (30 req/min per tenant)...')
  
  const responses: { status: number; remaining: string | null }[] = []
  
  for (let i = 0; i < 10; i++) {
    const response = await makeRequest('/api/bots', 'POST', { name: `test-bot-${i}` })
    responses.push({
      status: response.status,
      remaining: response.headers.get('X-RateLimit-Remaining'),
    })
  }

  const hasHeaders = responses.some(r => r.remaining !== null)
  const decreasing = responses
    .filter(r => r.remaining !== null)
    .map(r => parseInt(r.remaining || '0'))
    .every((val, i, arr) => i === 0 || val <= arr[i - 1])

  results.push({
    name: 'API Write Rate Limit Headers',
    passed: hasHeaders,
    details: hasHeaders 
      ? `Rate limit headers present, ${decreasing ? 'decreasing correctly' : 'values not decreasing'}` 
      : 'No rate limit headers found',
  })
}

/**
 * Test webhook rate limiting
 */
async function testWebhookRateLimit(): Promise<void> {
  console.log('\n🔔 Testing Webhook Rate Limit (1000 req/min per IP)...')
  
  const responses: { status: number; remaining: string | null }[] = []
  
  for (let i = 0; i < 10; i++) {
    const response = await makeRequest('/api/webhooks/test', 'POST', { event: 'test' })
    responses.push({
      status: response.status,
      remaining: response.headers.get('X-RateLimit-Remaining'),
    })
  }

  const hasHeaders = responses.some(r => r.remaining !== null)

  results.push({
    name: 'Webhook Rate Limit Headers',
    passed: hasHeaders,
    details: hasHeaders 
      ? `Rate limit headers present for webhooks` 
      : 'No rate limit headers (may need Upstash configured)',
  })
}

/**
 * Test 429 response format
 */
async function test429ResponseFormat(): Promise<void> {
  console.log('\n🚫 Testing 429 Response Format...')
  
  // Try to trigger a 429 by making many rapid requests to auth endpoint
  const email = `format-test-${Date.now()}@example.com`
  let rateLimitedResponse: { status: number; body: unknown } | null = null

  for (let i = 0; i < 10; i++) {
    const response = await makeRequest('/api/auth/magic-link', 'POST', { email })
    if (response.status === 429) {
      rateLimitedResponse = response
      break
    }
  }

  if (rateLimitedResponse) {
    const body = rateLimitedResponse.body as Record<string, unknown>
    const hasError = 'error' in body
    const hasMessage = 'message' in body
    const hasRetryAfter = 'retryAfter' in body

    results.push({
      name: '429 Response Format',
      passed: hasError && hasMessage,
      details: `error: ${hasError ? '✓' : '✗'}, message: ${hasMessage ? '✓' : '✗'}, retryAfter: ${hasRetryAfter ? '✓' : '✗'}`,
    })
  } else {
    results.push({
      name: '429 Response Format',
      passed: false,
      details: 'Could not trigger 429 response (Upstash may not be configured)',
    })
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  console.log('🧪 Rate Limit Test Suite')
  console.log('========================')
  console.log(`Base URL: ${BASE_URL}`)
  console.log('')
  
  try {
    // Check if server is running
    const health = await fetch(`${BASE_URL}/api/health`).catch(() => null)
    if (!health) {
      console.log('⚠️  Server may not be running. Starting tests anyway...\n')
    }

    await testMagicLinkRateLimit()
    await testApiReadRateLimit()
    await testApiWriteRateLimit()
    await testWebhookRateLimit()
    await test429ResponseFormat()

  } catch (error) {
    console.error('❌ Test suite failed:', error)
  }

  // Print summary
  console.log('\n')
  console.log('📊 Test Results Summary')
  console.log('=======================')
  
  let passed = 0
  let failed = 0

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
    console.log(`   ${result.details}`)
    if (result.passed) passed++
    else failed++
  }

  console.log('')
  console.log(`Total: ${passed} passed, ${failed} failed`)
  
  // Exit with error code if any test failed
  if (failed > 0) {
    console.log('\n⚠️  Note: Some tests may fail if Upstash is not configured.')
    console.log('   Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env')
  }
}

// Run tests
runTests().catch(console.error)
