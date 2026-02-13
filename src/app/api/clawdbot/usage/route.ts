import { NextResponse } from "next/server"
import { getUsageStats, trackUsage, resetUsage } from "@/lib/usage-tracker"

export async function GET() {
  try {
    const stats = await getUsageStats()
    
    return NextResponse.json({
      success: true,
      data: {
        dailyCost: stats.daily.costUsd,
        monthlyCost: stats.monthly.costUsd,
        totalCost: stats.totals.totalCostUsd,
        totalTokens: stats.totals.inputTokens + stats.totals.outputTokens,
        inputTokens: stats.totals.inputTokens,
        outputTokens: stats.totals.outputTokens,
        requestCount: stats.totals.requestCount,
        dailyRequests: stats.daily.requestCount,
        monthlyRequests: stats.monthly.requestCount,
        lastUpdated: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[API] Usage fetch error:", error)
    
    return NextResponse.json({
      success: true,
      data: {
        dailyCost: 0,
        monthlyCost: 0,
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
        dailyRequests: 0,
        monthlyRequests: 0,
        lastUpdated: new Date().toISOString(),
      },
    })
  }
}

// Track a new usage record
export async function POST(request: Request) {
  try {
    const { model, inputTokens, outputTokens } = await request.json()
    
    if (!model || inputTokens === undefined || outputTokens === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }
    
    const record = await trackUsage(model, inputTokens, outputTokens)
    
    return NextResponse.json({
      success: true,
      data: record,
    })
  } catch (error) {
    console.error("[API] Usage track error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to track usage" },
      { status: 500 }
    )
  }
}

// Reset usage stats
export async function DELETE() {
  try {
    await resetUsage()
    
    return NextResponse.json({
      success: true,
      message: "Usage stats reset",
    })
  } catch (error) {
    console.error("[API] Usage reset error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to reset usage" },
      { status: 500 }
    )
  }
}
