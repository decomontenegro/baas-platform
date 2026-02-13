import { promises as fs } from 'fs'
import path from 'path'

const USAGE_FILE = process.env.USAGE_FILE || '/tmp/baas-usage.json'

export interface UsageRecord {
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface UsageData {
  records: UsageRecord[]
  totals: {
    inputTokens: number
    outputTokens: number
    totalCostUsd: number
    requestCount: number
  }
  daily: {
    date: string
    costUsd: number
    requestCount: number
  }
  monthly: {
    month: string
    costUsd: number
    requestCount: number
  }
}

// Model pricing (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4': { input: 15, output: 75 },
  'anthropic/claude-opus-4-5': { input: 15, output: 75 },
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'groq/llama-3.3-70b-versatile': { input: 0, output: 0 },
  'groq/llama-3.1-8b-instant': { input: 0, output: 0 },
  'ollama/llama3': { input: 0, output: 0 },
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['anthropic/claude-sonnet-4']
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

async function readUsageFile(): Promise<UsageData> {
  try {
    const data = await fs.readFile(USAGE_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      records: [],
      totals: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, requestCount: 0 },
      daily: { date: new Date().toISOString().split('T')[0], costUsd: 0, requestCount: 0 },
      monthly: { month: new Date().toISOString().slice(0, 7), costUsd: 0, requestCount: 0 },
    }
  }
}

async function writeUsageFile(data: UsageData): Promise<void> {
  await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2))
}

export async function trackUsage(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<UsageRecord> {
  const cost = calculateCost(model, inputTokens, outputTokens)
  const record: UsageRecord = {
    timestamp: Date.now(),
    model,
    inputTokens,
    outputTokens,
    costUsd: cost,
  }

  const data = await readUsageFile()
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = new Date().toISOString().slice(0, 7)

  // Reset daily if new day
  if (data.daily.date !== today) {
    data.daily = { date: today, costUsd: 0, requestCount: 0 }
  }

  // Reset monthly if new month
  if (data.monthly.month !== thisMonth) {
    data.monthly = { month: thisMonth, costUsd: 0, requestCount: 0 }
  }

  // Update totals
  data.records.push(record)
  data.totals.inputTokens += inputTokens
  data.totals.outputTokens += outputTokens
  data.totals.totalCostUsd += cost
  data.totals.requestCount += 1

  // Update daily
  data.daily.costUsd += cost
  data.daily.requestCount += 1

  // Update monthly
  data.monthly.costUsd += cost
  data.monthly.requestCount += 1

  // Keep only last 1000 records
  if (data.records.length > 1000) {
    data.records = data.records.slice(-1000)
  }

  await writeUsageFile(data)
  return record
}

export async function getUsageStats(): Promise<UsageData> {
  const data = await readUsageFile()
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = new Date().toISOString().slice(0, 7)

  // Reset if stale
  if (data.daily.date !== today) {
    data.daily = { date: today, costUsd: 0, requestCount: 0 }
  }
  if (data.monthly.month !== thisMonth) {
    data.monthly = { month: thisMonth, costUsd: 0, requestCount: 0 }
  }

  return data
}

export async function resetUsage(): Promise<void> {
  const emptyData: UsageData = {
    records: [],
    totals: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, requestCount: 0 },
    daily: { date: new Date().toISOString().split('T')[0], costUsd: 0, requestCount: 0 },
    monthly: { month: new Date().toISOString().slice(0, 7), costUsd: 0, requestCount: 0 },
  }
  await writeUsageFile(emptyData)
}
