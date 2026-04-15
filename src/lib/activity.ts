import { execute, query } from './db'

interface ActivityInput {
  entityType: string
  entityId?: number | null
  action: string
  title: string
  summary?: string
  metadata?: Record<string, unknown>
}

interface LinkInput {
  sourceType: string
  sourceId: number
  projectId?: number | null
  contactId?: number | null
  companyName?: string | null
  tags?: string[] | null
}

export async function logActivity(input: ActivityInput): Promise<void> {
  await execute(
    `INSERT INTO activity_log (entity_type, entity_id, action, title, summary, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.entityType,
      input.entityId ?? null,
      input.action,
      input.title,
      input.summary ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  )
}

export async function syncEntityLinks(input: LinkInput): Promise<void> {
  await execute(`DELETE FROM entity_links WHERE source_type = $1 AND source_id = $2`, [input.sourceType, input.sourceId])

  const inserts: Array<Promise<number>> = []

  if (input.projectId) {
    inserts.push(
      execute(
        `INSERT INTO entity_links (source_type, source_id, target_type, target_id) VALUES ($1, $2, 'project', $3)`,
        [input.sourceType, input.sourceId, input.projectId]
      )
    )
  }

  if (input.contactId) {
    inserts.push(
      execute(
        `INSERT INTO entity_links (source_type, source_id, target_type, target_id) VALUES ($1, $2, 'contact', $3)`,
        [input.sourceType, input.sourceId, input.contactId]
      )
    )
  }

  if (input.companyName?.trim()) {
    inserts.push(
      execute(
        `INSERT INTO entity_links (source_type, source_id, target_type, target_text) VALUES ($1, $2, 'company', $3)`,
        [input.sourceType, input.sourceId, input.companyName.trim()]
      )
    )
  }

  for (const tag of input.tags ?? []) {
    if (!tag?.trim()) continue
    inserts.push(
      execute(
        `INSERT INTO entity_links (source_type, source_id, target_type, target_text) VALUES ($1, $2, 'tag', $3)`,
        [input.sourceType, input.sourceId, tag.trim()]
      )
    )
  }

  await Promise.all(inserts)
}

export async function findLinkedEntityIds(targetType: string, queryText: string): Promise<Array<{ source_type: string; source_id: number }>> {
  return query(
    `SELECT DISTINCT source_type, source_id
     FROM entity_links
     WHERE target_type = $1 AND (
       target_text ILIKE $2 OR CAST(target_id AS TEXT) = $3
     )`,
    [targetType, `%${queryText}%`, queryText]
  )
}
