import { Pool } from '@neondatabase/serverless'

// Multi-tenant database configuratie
const getDatabaseConfig = () => {
  const tenantId = process.env.TENANT_ID || 'daan'
  
  const configs: Record<string, { connectionString: string | undefined; schema: string }> = {
    daan: {
      connectionString: process.env.DATABASE_URL_DAAN || process.env.DATABASE_URL,
      schema: 'public'
    },
    broer: {
      connectionString: process.env.DATABASE_URL_BROER || process.env.DATABASE_URL,
      schema: 'public'
    }
  }
  
  return configs[tenantId] || configs.daan
}

const pool = new Pool(getDatabaseConfig())

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
      subcategory TEXT,
      merchant_raw TEXT,
      merchant_normalized TEXT,
      category_confidence NUMERIC(4,3),
      recurrence_type TEXT DEFAULT 'none',
      recurrence_confidence NUMERIC(4,3),
      subscription_status TEXT DEFAULT 'none',
      fixed_cost_flag SMALLINT DEFAULT 0,
      essential_flag SMALLINT DEFAULT 0,
      personal_business TEXT DEFAULT 'unknown',
      user_verified SMALLINT DEFAULT 0,
      user_notes TEXT,
      needs_review SMALLINT DEFAULT 0,
      question_queue_status TEXT DEFAULT 'none',
      account TEXT DEFAULT 'privé',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS finance_merchant_rules (
      id SERIAL PRIMARY KEY,
      merchant_key TEXT NOT NULL UNIQUE,
      merchant_label TEXT,
      category TEXT,
      subcategory TEXT,
      merchant_type TEXT,
      recurrence_type TEXT,
      subscription_override TEXT,
      personal_business TEXT,
      fixed_cost_flag SMALLINT DEFAULT 0,
      essential_flag SMALLINT DEFAULT 0,
      notes TEXT,
      user_verified SMALLINT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS finance_review_queue (
      id SERIAL PRIMARY KEY,
      queue_key TEXT NOT NULL UNIQUE,
      merchant_key TEXT,
      question_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      rationale TEXT,
      priority INTEGER DEFAULT 50,
      confidence TEXT DEFAULT 'low',
      status TEXT DEFAULT 'pending',
      context TEXT DEFAULT '{}',
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
      import_run_id INT,
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
      start_time TEXT,
      end_time TEXT,
      energy_level INTEGER,
      category TEXT DEFAULT 'business',
      type TEXT DEFAULT 'deep_work',
      expected_duration_minutes INTEGER,
      actual_duration_minutes INTEGER,
      interruptions TEXT,
      billable SMALLINT DEFAULT 0,
      hourly_rate NUMERIC(8,2),
      source TEXT DEFAULT 'manual',
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
      import_run_id INT,
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
      recurring TEXT,
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
      import_run_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS groceries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      quantity TEXT,
      category TEXT DEFAULT 'overig',
      completed SMALLINT DEFAULT 0,
      completed_at TIMESTAMPTZ,
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

    CREATE TABLE IF NOT EXISTS ai_theories (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'algemeen',
      theory TEXT NOT NULL,
      confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
      supporting_data TEXT DEFAULT '[]',
      times_confirmed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'hypothesis',
      source_modules TEXT DEFAULT '[]',
      impact_score NUMERIC(4,2) DEFAULT 0.5,
      action_potential TEXT,
      question_asked SMALLINT DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS proactive_log (
      id SERIAL PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      trigger_details TEXT DEFAULT '{}',
      message_sent TEXT,
      telegram_sent SMALLINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS nudge_state (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL UNIQUE,
      nudge_count INTEGER DEFAULT 0,
      last_nudged_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS journal_conversation (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL DEFAULT 'idle',
      pending_question TEXT,
      context_snapshot TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pending_actions (
      session_key TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'chat',
      preview TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      idle_expires_at TIMESTAMPTZ NOT NULL,
      absolute_expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      key TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      blocked_until TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS pending_questions (
      id SERIAL PRIMARY KEY,
      source_module TEXT NOT NULL DEFAULT 'algemeen',
      theory_id INTEGER,
      question TEXT NOT NULL,
      rationale TEXT,
      priority INTEGER DEFAULT 50,
      confidence NUMERIC(4,3) DEFAULT 0.5,
      impact_score NUMERIC(4,2) DEFAULT 0.5,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','answered','dismissed')),
      answer TEXT,
      answer_processed SMALLINT DEFAULT 0,
      sent_at TIMESTAMPTZ,
      answered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pattern_observations (
      id SERIAL PRIMARY KEY,
      obs_date DATE NOT NULL DEFAULT CURRENT_DATE,
      module TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      metric_value NUMERIC,
      metric_text TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(obs_date, module, metric_key)
    );

    CREATE TABLE IF NOT EXISTS pattern_rules (
      id SERIAL PRIMARY KEY,
      rule_type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      replacement TEXT NOT NULL,
      confidence NUMERIC(4,3) DEFAULT 1.0,
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS finance_balances (
      id SERIAL PRIMARY KEY,
      account TEXT NOT NULL UNIQUE,
      balance NUMERIC(12,2) DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS active_timers (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      context TEXT NOT NULL DEFAULT 'overig',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT DEFAULT 'chat',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversation_session (
      session_key TEXT PRIMARY KEY,
      last_domain TEXT,
      last_result JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS telegram_flow_state (
      id SERIAL PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      flow_type TEXT NOT NULL,
      step INT NOT NULL DEFAULT 1,
      data JSONB NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS import_runs (
      id SERIAL PRIMARY KEY,
      source_type TEXT NOT NULL DEFAULT 'paste',
      source_label TEXT,
      raw_input TEXT NOT NULL,
      normalized_input TEXT,
      status TEXT NOT NULL DEFAULT 'processing'
        CHECK(status IN ('processing','segmenting','review','executing','completed','cancelled','error')),
      total_candidates INT DEFAULT 0,
      accepted_count INT DEFAULT 0,
      skipped_count INT DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS import_candidates (
      id SERIAL PRIMARY KEY,
      import_run_id INT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
      source_excerpt TEXT NOT NULL,
      source_position INT DEFAULT 0,
      candidate_type TEXT NOT NULL,
      target_module TEXT NOT NULL,
      confidence FLOAT NOT NULL DEFAULT 0.5,
      temporal_context TEXT NOT NULL DEFAULT 'current'
        CHECK(temporal_context IN ('current','historical','future_plan','uncertain')),
      normalized_text TEXT NOT NULL,
      suggested_title TEXT,
      ai_reasoning TEXT,
      suggested_action TEXT NOT NULL DEFAULT 'create'
        CHECK(suggested_action IN ('create','merge','update','ignore')),
      matched_entity_type TEXT,
      matched_entity_id INT,
      match_confidence FLOAT,
      match_reasoning TEXT,
      review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK(review_status IN ('pending','accepted','merged','skipped','modified')),
      reviewer_notes TEXT,
      reviewed_at TIMESTAMPTZ,
      created_entity_type TEXT,
      created_entity_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS import_followups (
      id SERIAL PRIMARY KEY,
      import_run_id INT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      context_candidates TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','sent','answered','dismissed')),
      answer TEXT,
      sent_at TIMESTAMPTZ,
      answered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'text'
        CHECK(data_type IN ('text','number','date','boolean','list')),
      confidence NUMERIC(4,3) DEFAULT 1.0,
      source TEXT DEFAULT 'manual'
        CHECK(source IN ('manual','chat','ai','import')),
      category TEXT DEFAULT 'algemeen'
        CHECK(category IN ('algemeen','werk','gezondheid','financieel','sociaal','doelen','routines','voorkeuren')),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notification_rules (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'telegram'
        CHECK(type IN ('telegram','app')),
      trigger_type TEXT NOT NULL DEFAULT 'scheduled'
        CHECK(trigger_type IN ('scheduled','event','threshold')),
      schedule_hour INT,
      schedule_days TEXT DEFAULT '1,2,3,4,5',
      message_template TEXT NOT NULL,
      enabled BOOLEAN DEFAULT true,
      last_sent_at TIMESTAMPTZ,
      last_message_hash TEXT,
      cooldown_hours INT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS health_logs (
      id SERIAL PRIMARY KEY,
      log_date DATE NOT NULL DEFAULT CURRENT_DATE,
      sleep_start TIMESTAMPTZ,
      sleep_end TIMESTAMPTZ,
      sleep_hours NUMERIC(4,2),
      sleep_quality INT CHECK(sleep_quality BETWEEN 1 AND 5),
      energy_level INT CHECK(energy_level BETWEEN 1 AND 10),
      stress_level INT CHECK(stress_level BETWEEN 1 AND 10),
      pain_score INT CHECK(pain_score BETWEEN 0 AND 10),
      pain_location TEXT,
      water_glasses INT DEFAULT 0,
      symptoms TEXT[],
      medications TEXT[],
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(log_date)
    );

    INSERT INTO user_settings (key, value) VALUES
      ('debug_mode', 'false'),
      ('module_gezondheid', 'true'),
      ('module_groceries', 'true'),
      ('module_agenda', 'true'),
      ('module_financien', 'true'),
      ('notification_morning_hour', '8'),
      ('notification_enabled', 'true'),
      ('life_coach_enabled', 'true'),
      ('onboarding_completed', 'false'),
      ('theme', 'light')
    ON CONFLICT (key) DO NOTHING;

    -- Extra columns for existing tables (migrations)
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS import_run_id INT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS import_candidate_id INT;
    
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS import_run_id INT;
    
    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS import_run_id INT;
    
    ALTER TABLE events ADD COLUMN IF NOT EXISTS recurring TEXT;

    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS account TEXT DEFAULT 'privé';
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS subcategory TEXT;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS merchant_raw TEXT;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS merchant_normalized TEXT;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS category_confidence NUMERIC(4,3);
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'none';
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS recurrence_confidence NUMERIC(4,3);
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS fixed_cost_flag SMALLINT DEFAULT 0;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS essential_flag SMALLINT DEFAULT 0;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS personal_business TEXT DEFAULT 'unknown';
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS user_verified SMALLINT DEFAULT 0;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS user_notes TEXT;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS needs_review SMALLINT DEFAULT 0;
    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS question_queue_status TEXT DEFAULT 'none';

    ALTER TABLE habits ADD COLUMN IF NOT EXISTS active SMALLINT DEFAULT 1;

    ALTER TABLE work_logs
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'business',
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deep_work',
      ADD COLUMN IF NOT EXISTS expected_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS start_time TEXT,
      ADD COLUMN IF NOT EXISTS end_time TEXT,
      ADD COLUMN IF NOT EXISTS interruptions TEXT,
      ADD COLUMN IF NOT EXISTS billable SMALLINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
    
    ALTER TABLE ai_theories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'hypothesis';
    ALTER TABLE ai_theories ADD COLUMN IF NOT EXISTS source_modules TEXT DEFAULT '[]';
    ALTER TABLE ai_theories ADD COLUMN IF NOT EXISTS impact_score NUMERIC(4,2) DEFAULT 0.5;
    ALTER TABLE ai_theories ADD COLUMN IF NOT EXISTS action_potential TEXT;
    ALTER TABLE ai_theories ADD COLUMN IF NOT EXISTS question_asked SMALLINT DEFAULT 0;
  `)
}

export default pool
