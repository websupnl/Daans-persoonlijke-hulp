import { z } from 'zod'

export const ChatActionResultSchema = z.object({
  action: z.string().min(1),
  attempted: z.boolean(),
  executed: z.boolean(),
  verified: z.boolean(),
  userMessage: z.string().min(1),
  correlationId: z.string().min(1).optional(),
  details: z.unknown().optional(),
})

export const ChatActionResultsSchema = z.array(ChatActionResultSchema)

export type ChatActionResult = z.infer<typeof ChatActionResultSchema>

export function canClaimSuccess(result: Pick<ChatActionResult, 'executed' | 'verified'>): boolean {
  return result.executed && result.verified
}
