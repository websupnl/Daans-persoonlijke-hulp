import { z } from 'zod'

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
})

export const ApiMetaSchema = z.object({
  correlationId: z.string().min(1).optional(),
  timestamp: z.string().datetime().optional(),
})

export const ApiEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    meta: ApiMetaSchema.optional(),
  })

export type ApiError = z.infer<typeof ApiErrorSchema>
export type ApiMeta = z.infer<typeof ApiMetaSchema>

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export function ok<T>(data: T, meta?: ApiMeta): ApiEnvelope<T> {
  return {
    success: true,
    data,
    meta,
  }
}

export function fail(code: string, message: string, details?: unknown, meta?: ApiMeta): ApiEnvelope<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta,
  }
}
