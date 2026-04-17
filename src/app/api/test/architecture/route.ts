/**
 * Test Architecture API
 * 
 * TEMPORARILY DISABLED - Legacy dependencies moved
 * TODO: Update to work with SimpleChatProcessor
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Test architecture route temporarily disabled during chat architecture rebuild',
    status: 'disabled'
  })
}
