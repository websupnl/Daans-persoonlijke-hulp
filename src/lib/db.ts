import { createClient, type Client, type ResultSet } from '@libsql/client'
import path from 'path'
import fs from 'fs'

export type DbRow = Record<string, unknown>

export function toRows(result: ResultSet): DbRow[] {
  return result.rows.map(row =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  )
}

export function toRow(result: ResultSet): DbRow | undefined {
  if (result.rows.length === 0) return undefined
  return Object.fromEntries(result.columns.map((col, i) => [col, result.rows[0][i]]))
}

let initPromise: Promise<Client> | undefined

export async function getDb(): Promise<Client> {
  if (!initPromise) {
    initPromise = initDb()
  }
  return initPromise
}

async function initDb(): Promise<Client> {
  if (!process.env.TURSO_DATABASE_URL) {
    const dataDir = path.resolve(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  }

  const dbPath = path.resolve(process.cwd(), 'data/persoonlijke-hulp.db')
  const url = process.env.TURSO_DATABASE_URL ?? `file:${dbPath}`
  const authToken = process.env.TURSO_AUTH_TOKEN

  const db = createClient(authToken ? { url, authToken } : { url })
  await initSchema(db)
  return db
}

async function initSchema(db: Client): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'actief' CHECK(status IN ('actief','on-hold','afgerond')),
      color TEXT DEFAULT '#6172f3',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'persoon' CHECK(type IN ('persoon','bedrijf')),
      email TEXT,
      phone TEXT,
      company TEXT,
      website TEXT,
      address TEXT,
      notes TEXT,
      tags TEXT DEFAULT '[]',
      last_contact TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'overig',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('hoog','medium','laag')),
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      recurring TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT 'Naamloze note',
      content TEXT DEFAULT '',
      content_text TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('factuur','inkomst','uitgave')),
      title TEXT NOT NULL,
      description TEXT,
      amount REAL DEFAULT 0,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'concept' CHECK(status IN ('concept','verstuurd','betaald','verlopen','geannuleerd')),
      invoice_number TEXT,
      due_date TEXT,
      paid_date TEXT,
      category TEXT DEFAULT 'overig',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      frequency TEXT DEFAULT 'dagelijks' CHECK(frequency IN ('dagelijks','wekelijks')),
      target INTEGER DEFAULT 1,
      color TEXT DEFAULT '#6172f3',
      icon TEXT DEFAULT '⭐',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      logged_date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(habit_id, logged_date)
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      content TEXT DEFAULT '',
      mood INTEGER CHECK(mood BETWEEN 1 AND 5),
      energy INTEGER CHECK(energy BETWEEN 1 AND 5),
      gratitude TEXT DEFAULT '[]',
      highlights TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'algemeen',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      actions TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title, content_text, tags,
      content=notes,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content_text, tags)
      VALUES (new.id, new.title, new.content_text, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content_text, tags)
      VALUES ('delete', old.id, old.title, old.content_text, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content_text, tags)
      VALUES ('delete', old.id, old.title, old.content_text, old.tags);
      INSERT INTO notes_fts(rowid, title, content_text, tags)
      VALUES (new.id, new.title, new.content_text, new.tags);
    END;
  `)
}

export default getDb
