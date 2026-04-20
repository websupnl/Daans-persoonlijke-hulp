import { NextRequest, NextResponse } from 'next/server'
import { ApiEnvelope, ApiMeta, fail, ok } from '@/lib/contracts/api-envelope'

function getCorrelationId(req?: NextRequest): string | undefined {
  if (!req) return undefined
  return (
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    crypto.randomUUID()
  )
}

function buildMeta(req?: NextRequest): ApiMeta {
  return {
    correlationId: getCorrelationId(req),
    timestamp: new Date().toISOString(),
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit, req?: NextRequest): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(ok(data, buildMeta(req)), init)
}

export function jsonFail(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
  req?: NextRequest
): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json(fail(code, message, details, buildMeta(req)), { status })
}
