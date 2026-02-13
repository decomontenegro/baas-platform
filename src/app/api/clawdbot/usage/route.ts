import { NextResponse } from "next/server"

export async function GET() {
  try {
    const clawdbotUrl = process.env.CLAWDBOT_URL || "http://localhost:18789"
    
    // Get usage data from Clawdbot
    const response = await fetch(`${clawdbotUrl}/api/usage`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    
    if (!response.ok) {
      // Return estimated data if Clawdbot API not available
      return NextResponse.json({
        success: true,
        data: {
          dailyCost: 0,
          monthlyCost: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          requestCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      })
    }
    
    const data = await response.json()
    
    // Calculate costs from token usage
    // Approximate pricing: $3/M input, $15/M output for Claude Sonnet
    const inputCost = (data.inputTokens || 0) / 1_000_000 * 3
    const outputCost = (data.outputTokens || 0) / 1_000_000 * 15
    const totalCost = inputCost + outputCost
    
    // Get daily cost (approximate from session data if available)
    const dailyCost = data.dailyCost || totalCost * 0.1 // rough estimate
    
    return NextResponse.json({
      success: true,
      data: {
        dailyCost,
        monthlyCost: totalCost,
        totalTokens: data.totalTokens || 0,
        inputTokens: data.inputTokens || 0,
        outputTokens: data.outputTokens || 0,
        requestCount: data.requestCount || 0,
        lastUpdated: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[API] Usage fetch error:", error)
    
    // Return zero data on error
    return NextResponse.json({
      success: true,
      data: {
        dailyCost: 0,
        monthlyCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
        lastUpdated: new Date().toISOString(),
      },
    })
  }
}
