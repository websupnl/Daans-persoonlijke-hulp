import { NextRequest, NextResponse } from 'next/server'
import { generateMemories } from '@/lib/ai/memory-crawler'
import { collectDailyObservations, runDailyPatternAnalysis } from '@/lib/ai/pattern-engine'
import { runProactiveEngine } from '@/lib/ai/proactive-engine'

export async function POST(req: NextRequest) {
  try {
    // 1. Collect observations
    await collectDailyObservations()
    
    // 2. Generate memories from all data
    const memoryResult = await generateMemories()
    
    // 3. Run pattern analysis
    const patternResult = await runDailyPatternAnalysis()
    
    // 4. Run proactive engine
    const proactiveResult = await runProactiveEngine()

    return NextResponse.json({
      success: true,
      memories: memoryResult,
      patterns: patternResult,
      proactive: proactiveResult.triggered ? 'triggered' : 'none'
    })
  } catch (error) {
    console.error('[AI Sync API] Error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
