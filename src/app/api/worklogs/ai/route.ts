/**
 * Worklogs AI API
 * 
 * TEMPORARILY DISABLED - Legacy dependencies moved
 * TODO: Update to work with SimpleChatProcessor
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Worklogs AI route temporarily disabled during chat architecture rebuild',
    status: 'disabled'
  })
}
