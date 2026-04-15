import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Auto-initialize schema on first request per process instance
let _schemaReady = false
async function ensureSchema() {
  if (_schemaReady) return
  try { await initSchema(); _schemaReady = true } catch { /* already migrated or transient error */ }
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  await ensureSchema()
  const result = await pool.query(text, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | undefined> {
  await ensureSchema()
  const result = await pool.query(text, params)
  return result.rows[0] as T | undefined
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  await ensureSchema()
  const result = await pool.query(text, params)
  return result.rowCount ?? 0
}

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'actief' CHECK(status IN ('actief','on-hold','afgerond')),
      color TEXT DEFAULT '#6172f3',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'persoon' CHECK(type IN ('persoon','bedrijf')),
      email TEXT,
      phone TEXT,
      company TEXT,
      website TEXT,
      address TEXT,
      notes TEXT,
      tags TEXT DEFAULT '[]',
      last_contact DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'overig',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('hoog','medium','laag')),
      due_date DATE,
      completed SMALLINT DEFAULT 0,
      completed_at TIMESTAMPTZ,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      recurring TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title TEXT DEFAULT 'Naamloze note',
      content TEXT DEFAULT '',
      content_text TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned SMALLINT DEFAULT 0,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS finance_items (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('factuur','inkomst','uitgave')),
      title TEXT NOT NULL,
      description TEXT,
      amount NUMERIC(12,2) DEFAULT 0,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'concept' CHECK(status IN ('concept','verstuurd','betaald','verlopen','geannuleerd')),
      invoice_number TEXT,
      due_date DATE,
      paid_date DATE,
      category TEXT DEFAULT 'overig',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS habits (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      frequency TEXT DEFAULT 'dagelijks' CHECK(frequency IN ('dagelijks','wekelijks')),
      target INTEGER DEFAULT 1,
      color TEXT DEFAULT '#6172f3',
      icon TEXT DEFAULT '⭐',
      active SMALLINT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id SERIAL PRIMARY KEY,
      habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      logged_date DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(habit_id, logged_date)
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      content TEXT DEFAULT '',
      mood INTEGER CHECK(mood BETWEEN 1 AND 5),
      energy INTEGER CHECK(energy BETWEEN 1 AND 5),
      gratitude TEXT DEFAULT '[]',
      highlights TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memories (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'algemeen',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      actions TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversation_log (
      id SERIAL PRIMARY KEY,
      user_message TEXT NOT NULL,
      assistant_message TEXT,
      raw_ai_result TEXT,
      parser_type TEXT NOT NULL DEFAULT 'rule',
      confidence NUMERIC(4,3),
      actions TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS work_logs (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      context TEXT NOT NULL DEFAULT 'overig',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      energy_level INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'chat',
      raw_text TEXT NOT NULL,
      parsed_status TEXT NOT NULL DEFAULT 'pending',
      suggested_type TEXT,
      suggested_context TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS memory_log (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      confidence NUMERIC(4,3) NOT NULL DEFAULT 0.8,
      source_message_id INTEGER,
      last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      time TEXT,
      duration INTEGER DEFAULT 60,
      type TEXT DEFAULT 'algemeen' CHECK(type IN ('vergadering','deadline','afspraak','herinnering','algemeen')),
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      all_day SMALLINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      raw_input TEXT NOT NULL DEFAULT '',
      refined_summary TEXT,
      verdict TEXT DEFAULT 'nog beoordelen' CHECK(verdict IN ('super slim','kansrijk','twijfelachtig','niet waardig','nog beoordelen')),
      score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'nieuw' CHECK(status IN ('nieuw','uitwerken','valideren','wachten','archief')),
      market_gap TEXT,
      next_steps TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS entity_links (
      id SERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      target_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE work_logs
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'business',
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deep_work',
      ADD COLUMN IF NOT EXISTS expected_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS interruptions TEXT,
      ADD COLUMN IF NOT EXISTS billable SMALLINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

    -- Proactive Brain: AI theories about the user (long-term pattern recognition)
    CREATE TABLE IF NOT EXISTS ai_theories (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'algemeen',
      theory TEXT NOT NULL,
      confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
      supporting_data TEXT DEFAULT '[]',
      times_confirmed INTEGER DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Proactive Brain: log of all sent proactive messages (prevent spam)
    CREATE TABLE IF NOT EXISTS proactive_log (
      id SERIAL PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      trigger_details TEXT DEFAULT '{}',
      message_sent TEXT,
      telegram_sent SMALLINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Proactive Brain: nudge state per topic (track urgency decay)
    CREATE TABLE IF NOT EXISTS nudge_state (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL UNIQUE,
      nudge_count INTEGER DEFAULT 0,
      last_nudged_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      metadata TEXT DEFAULT '{}'
    );

    -- Journal conversation state: pending follow-up questions
    CREATE TABLE IF NOT EXISTS journal_conversation (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL DEFAULT 'idle',
      pending_question TEXT,
      context_snapshot TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}

export default pool
