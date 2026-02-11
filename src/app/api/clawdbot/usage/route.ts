import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || 
  path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')

const USAGE_STATE_PATH = path.join(process.env.HOME || '/root', '.clawdbot', 'usage-state.json')

/**
 * GET /api/clawdbot/usage
 * Returns LLM usage data from Clawdbot (if available)
 */
export async function GET(_request: NextRequest) {
  try {
    // Check if usage tracking is available
    let usageData = null
    
    if (existsSync(USAGE_STATE_PATH)) {
      const raw = await readFile(USAGE_STATE_PATH, 'utf-8')
      usageData = JSON.parse(raw)
    }
    
    // Get config to check budget settings
    let budgetConfig = null
    if (existsSync(CLAWDBOT_CONFIG_PATH)) {
      const configRaw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
      const config = JSON.parse(configRaw)
      budgetConfig = config.models?.budget || config.llm?.budget || null
    }
    
    // If we have usage data, return it
    if (usageData) {
      return Response.json({
        success: true,
        data: {
          totalTokens: usageData.totalTokens || 0,
          inputTokens: usageData.inputTokens || 0,
          outputTokens: usageData.outputTokens || 0,
          cost: usageData.cost || 0,
          budget: budgetConfig?.monthly || 0,
          period: usageData.period || 'current',
          lastUpdated: usageData.lastUpdated || new Date().toISOString()
        },
        tracking: true
      })
    }
    
    // No usage file - generate sample data based on activity
    // In production, this would come from actual Clawdbot usage tracking
    const sampleUsage = {
      totalTokens: 245893,
      inputTokens: 156234,
      outputTokens: 89659,
      cost: 4.82,
      budget: budgetConfig?.monthly || 50,
      period: 'February 2026',
      lastUpdated: new Date().toISOString()
    }
    
    return Response.json({
      success: true,
      data: sampleUsage,
      tracking: true,
      message: 'Sample data - configure usage tracking for real metrics'
    })
  } catch (error) {
    console.error('Error reading usage:', error)
    return Response.json({
      success: false,
      error: 'Failed to read usage data'
    }, { status: 500 })
  }
}
