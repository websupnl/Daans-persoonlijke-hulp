import { NextRequest, NextResponse } from 'next/server'
import { TenantManager } from '@/lib/tenant/TenantManager'
import { DatabaseRouter } from '@/lib/tenant/DatabaseRouter'
import { TelegramBotManager } from '@/lib/tenant/TelegramBotManager'
import { Pool } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { tenant_name, database_url, telegram_bot_token, telegram_bot_username, user_data } = await req.json()

    if (!tenant_name || !database_url || !telegram_bot_token) {
      return NextResponse.json({ 
        error: 'Missing required fields: tenant_name, database_url, telegram_bot_token' 
      }, { status: 400 })
    }

    const tenantManager = TenantManager.getInstance()
    const dbRouter = DatabaseRouter.getInstance()

    // Create tenant
    const tenant = await tenantManager.createTenant({
      name: tenant_name,
      database_url,
      telegram_bot_token,
      telegram_bot_username: telegram_bot_username || `${tenant_name.toLowerCase()}_bot`
    })

    // Test database connection
    const connectionTest = await dbRouter.testConnection(tenant.id)
    if (!connectionTest) {
      return NextResponse.json({ 
        error: 'Database connection test failed' 
      }, { status: 400 })
    }

    // Create user if provided
    let user = null
    if (user_data) {
      user = await tenantManager.createUser({
        tenant_id: tenant.id,
        telegram_user_id: user_data.telegram_user_id,
        email: user_data.email,
        name: user_data.name
      })
    }

    // Initialize database schema for new tenant
    await initializeTenantDatabase(tenant.id, database_url)

    // Setup Telegram bot
    const botManager = TelegramBotManager.getInstance()
    await botManager.initializeBots()

    return NextResponse.json({
      success: true,
      tenant,
      user,
      message: `Tenant ${tenant_name} created successfully`
    })

  } catch (error: any) {
    console.error('Tenant setup error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to setup tenant' 
    }, { status: 500 })
  }
}

async function initializeTenantDatabase(tenantId: string, databaseUrl: string) {
  // Import database schema initialization
  const { Pool } = await import('@neondatabase/serverless')
  const pool = new Pool({ connectionString: databaseUrl })

  // Read schema file and execute
  const schemaSql = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      tenant_id VARCHAR(255) NOT NULL,
      telegram_user_id VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE,
      name VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'actief',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Todos table
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      priority VARCHAR(20) DEFAULT 'medium',
      due_date DATE,
      category VARCHAR(100) DEFAULT 'overig',
      project_id INTEGER REFERENCES projects(id),
      completed BOOLEAN DEFAULT false,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      time TIME,
      type VARCHAR(50) DEFAULT 'algemeen',
      description TEXT,
      duration INTEGER DEFAULT 60,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Habits table
    CREATE TABLE IF NOT EXISTS habits (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      target_frequency INTEGER DEFAULT 1,
      frequency_unit VARCHAR(20) DEFAULT 'daily',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Habit logs table
    CREATE TABLE IF NOT EXISTS habit_logs (
      id SERIAL PRIMARY KEY,
      habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
      logged_date DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(habit_id, logged_date)
    );

    -- Finance items table
    CREATE TABLE IF NOT EXISTS finance_items (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL, -- 'inkomst' or 'uitgave'
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category VARCHAR(100) DEFAULT 'overig',
      subcategory VARCHAR(100),
      description TEXT,
      due_date DATE,
      status VARCHAR(20) DEFAULT 'open',
      project_id INTEGER REFERENCES projects(id),
      account VARCHAR(100) DEFAULT 'privé',
      merchant_raw VARCHAR(255),
      merchant_normalized VARCHAR(255),
      category_confidence DECIMAL(3,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Groceries table
    CREATE TABLE IF NOT EXISTS groceries (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      quantity VARCHAR(100),
      category VARCHAR(100) DEFAULT 'overig',
      completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Work logs table
    CREATE TABLE IF NOT EXISTS work_logs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      duration_minutes INTEGER NOT NULL,
      actual_duration_minutes INTEGER,
      context TEXT,
      date DATE NOT NULL,
      description TEXT,
      project_id INTEGER REFERENCES projects(id),
      source VARCHAR(20) DEFAULT 'manual',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      content_text TEXT,
      tags JSONB,
      project_id INTEGER REFERENCES projects(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Journal entries table
    CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      date DATE UNIQUE NOT NULL,
      content TEXT,
      mood VARCHAR(50),
      energy INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Contacts table
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Active timers table
    CREATE TABLE IF NOT EXISTS active_timers (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      project_id INTEGER REFERENCES projects(id),
      context TEXT,
      source VARCHAR(20) DEFAULT 'manual',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Memory log table
    CREATE TABLE IF NOT EXISTS memory_log (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT,
      category VARCHAR(100),
      confidence DECIMAL(3,2),
      last_reinforced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity log table
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER,
      action VARCHAR(50) NOT NULL,
      title VARCHAR(255),
      summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Chat messages table
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      actions JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Conversation log table
    CREATE TABLE IF NOT EXISTS conversation_log (
      id SERIAL PRIMARY KEY,
      user_message TEXT,
      assistant_message TEXT,
      parser_type VARCHAR(50),
      confidence DECIMAL(3,2),
      actions JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(logged_date);
    CREATE INDEX IF NOT EXISTS idx_finance_items_date ON finance_items(due_date);
    CREATE INDEX IF NOT EXISTS idx_finance_items_type ON finance_items(type);
    CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
    CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
  `

  await pool.query(schemaSql)
  await pool.end()
}
