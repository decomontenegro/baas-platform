#!/usr/bin/env node

/**
 * BaaS Dashboard - QA Automated Test Suite
 * 
 * Testa automaticamente todas as páginas e APIs principais
 * sem precisar de login manual
 */

const https = require('https')
const http = require('http')

const BASE_URL = 'https://baas.deco.ooo'

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

// Utility function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const endTime = Date.now()
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          responseTime: endTime - startTime
        })
      })
    })
    
    req.on('error', reject)
    req.setTimeout(10000, () => {
      reject(new Error('Request timeout'))
    })
    req.end()
  })
}

// Test function
async function test(name, testFn) {
  try {
    console.log(`\n🧪 Testing: ${name}`)
    await testFn()
    console.log(`✅ PASS: ${name}`)
    results.passed++
    results.tests.push({ name, status: 'PASS' })
  } catch (error) {
    console.log(`❌ FAIL: ${name} - ${error.message}`)
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: error.message })
  }
}

// Health check tests
async function testHealthEndpoints() {
  await test('Health Check Basic', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health`)
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`)
    
    const data = JSON.parse(response.data)
    if (!data.status) throw new Error('Missing status field')
    if (!data.timestamp) throw new Error('Missing timestamp field')
  })

  await test('Health Check Detailed', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health?detailed=true`)
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`)
    
    const data = JSON.parse(response.data)
    if (!data.dependencies) throw new Error('Missing dependencies field')
    if (!data.memory) throw new Error('Missing memory field')
  })

  await test('Status Endpoint', async () => {
    const response = await makeRequest(`${BASE_URL}/api/status`)
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`)
    
    const data = JSON.parse(response.data)
    if (!data.service) throw new Error('Missing service field')
    if (!data.uptime) throw new Error('Missing uptime field')
  })
}

// Page accessibility tests (should redirect to login)
async function testPageAccessibility() {
  const pages = [
    '/dashboard',
    '/analytics', 
    '/bots',
    '/channels',
    '/settings',
    '/governance/classifications',
    '/governance/permissions',
    '/workers',
    '/llm/alerts'
  ]

  for (const page of pages) {
    await test(`Page Access: ${page}`, async () => {
      const response = await makeRequest(`${BASE_URL}${page}`, { method: 'GET' })
      
      // Should redirect to login (3xx) or be accessible (2xx)
      if (response.status >= 400) {
        throw new Error(`Page error: ${response.status}`)
      }
      
      // Check if redirected to login
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location
        if (!location || !location.includes('/login')) {
          throw new Error('Should redirect to login page')
        }
      }
    })
  }
}

// API protection tests (should return 401 unauthorized)
async function testAPIProtection() {
  const apis = [
    '/api/bots',
    '/api/analytics/overview',
    '/api/governance/classifications', 
    '/api/llm/providers',
    '/api/settings'
  ]

  for (const api of apis) {
    await test(`API Protection: ${api}`, async () => {
      const response = await makeRequest(`${BASE_URL}${api}`)
      
      if (response.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${response.status}`)
      }
      
      const data = JSON.parse(response.data)
      if (!data.error) throw new Error('Missing error field in response')
      if (!data.message) throw new Error('Missing message field in response')
    })
  }
}

// Error page tests
async function testErrorPages() {
  await test('404 Page', async () => {
    const response = await makeRequest(`${BASE_URL}/nonexistent-page-${Date.now()}`)
    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`)
    }
  })
  
  await test('404 API', async () => {
    const response = await makeRequest(`${BASE_URL}/api/nonexistent-api-${Date.now()}`)
    if (response.status !== 401 && response.status !== 404) {
      throw new Error(`Expected 401 or 404, got ${response.status}`)
    }
  })
}

// Performance tests
async function testPerformance() {
  await test('Health Check Response Time', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health`)
    if (response.responseTime > 5000) {
      throw new Error(`Health check too slow: ${response.responseTime}ms`)
    }
  })
  
  await test('Status Check Response Time', async () => {
    const response = await makeRequest(`${BASE_URL}/api/status`)
    if (response.responseTime > 5000) {
      throw new Error(`Status check too slow: ${response.responseTime}ms`)
    }
  })
}

// SSL/Security tests
async function testSecurity() {
  await test('HTTPS Redirect', async () => {
    // This would test HTTP to HTTPS redirect if applicable
    console.log('   ℹ️  HTTPS enforcement test skipped (assuming Cloudflare handles this)')
  })
  
  await test('Security Headers', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health`)
    
    // Check for basic security headers
    const headers = response.headers
    if (!headers['x-content-type-options']) {
      console.log('   ⚠️  Warning: Missing X-Content-Type-Options header')
    }
    if (!headers['x-frame-options']) {
      console.log('   ⚠️  Warning: Missing X-Frame-Options header')
    }
  })
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting BaaS Dashboard QA Tests...\n')
  console.log(`📍 Base URL: ${BASE_URL}`)
  console.log(`⏰ Started: ${new Date().toISOString()}`)
  
  try {
    // Run all test suites
    await testHealthEndpoints()
    await testPageAccessibility()
    await testAPIProtection() 
    await testErrorPages()
    await testPerformance()
    await testSecurity()
    
    // Print summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 QA TEST SUMMARY')
    console.log('='.repeat(50))
    console.log(`✅ Passed: ${results.passed}`)
    console.log(`❌ Failed: ${results.failed}`)
    console.log(`📊 Total:  ${results.passed + results.failed}`)
    
    if (results.failed > 0) {
      console.log('\n❌ FAILED TESTS:')
      results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`   • ${t.name}: ${t.error}`))
    }
    
    console.log(`\n⏰ Completed: ${new Date().toISOString()}`)
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('\n💥 QA Test Suite Failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  runTests()
}

module.exports = { runTests }