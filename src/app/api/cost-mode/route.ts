import { NextResponse } from "next/server"
import { CostMode, COST_MODE_PRESETS } from "@/types/cost-mode"

// Get current cost mode from Clawdbot config
export async function GET() {
  try {
    const clawdbotUrl = process.env.CLAWDBOT_URL || "http://localhost:18789"
    
    // Try to get cost mode from Clawdbot config
    const configRes = await fetch(`${clawdbotUrl}/api/config`, {
      headers: { "Content-Type": "application/json" },
    })
    
    if (configRes.ok) {
      const config = await configRes.json()
      const costMode = config.costMode || 'intelligent'
      const preset = COST_MODE_PRESETS[costMode as CostMode] || COST_MODE_PRESETS.intelligent
      
      return NextResponse.json({
        success: true,
        data: {
          mode: costMode,
          config: preset,
        },
      })
    }
    
    // Default to intelligent mode
    return NextResponse.json({
      success: true,
      data: {
        mode: 'intelligent',
        config: COST_MODE_PRESETS.intelligent,
      },
    })
  } catch (error) {
    console.error("[API] Cost mode fetch error:", error)
    return NextResponse.json({
      success: true,
      data: {
        mode: 'intelligent',
        config: COST_MODE_PRESETS.intelligent,
      },
    })
  }
}

// Update cost mode
export async function POST(request: Request) {
  try {
    const { mode } = await request.json()
    
    if (!['turbo', 'intelligent', 'economic'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: "Invalid mode" },
        { status: 400 }
      )
    }
    
    const preset = COST_MODE_PRESETS[mode as CostMode]
    const clawdbotUrl = process.env.CLAWDBOT_URL || "http://localhost:18789"
    
    // Update Clawdbot config with cost mode
    const configRes = await fetch(`${clawdbotUrl}/api/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        costMode: mode,
        // Apply model routing based on mode
        defaultModel: preset.modelRouting.medium,
      }),
    })
    
    if (!configRes.ok) {
      console.error("[API] Failed to update Clawdbot config")
    }
    
    return NextResponse.json({
      success: true,
      data: {
        mode,
        config: preset,
      },
    })
  } catch (error) {
    console.error("[API] Cost mode update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update cost mode" },
      { status: 500 }
    )
  }
}
