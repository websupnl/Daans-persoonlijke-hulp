import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | undefined> {
  const result = await pool.query(text, params)
  return result.rows[0] as T | undefined
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
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

    ALTER TABLE work_logs
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'business',
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deep_work',
      ADD COLUMN IF NOT EXISTS expected_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS interruptions TEXT,
      ADD COLUMN IF NOT EXISTS billable SMALLINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
  `)
}

export default pool
