/**
 * Seed script: vult de app met Daan's persoonlijke data.
 *
 * Gebruik:
 *   npm run seed              (lokale SQLite)
 *   npm run seed              (Turso als TURSO_DATABASE_URL in .env.local staat)
 */

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Laad .env.local
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
  for (const line of env.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
} catch { /* .env.local niet gevonden */ }

const url = process.env.TURSO_DATABASE_URL ?? `file:${resolve(ROOT, 'data/persoonlijke-hulp.db')}`
const authToken = process.env.TURSO_AUTH_TOKEN

console.log(`\n🌱 Seeden naar: ${url.startsWith('file:') ? 'lokale SQLite' : 'Turso database'}\n`)

const db = createClient(authToken ? { url, authToken } : { url })

async function run(sql, args = []) {
  return db.execute({ sql, args })
}

async function seed() {
  // ── Schema uitbreiding (events tabel als die nog niet bestaat) ──────────────
  await run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT,
    duration INTEGER DEFAULT 60,
    type TEXT DEFAULT 'algemeen',
    project_id INTEGER,
    contact_id INTEGER,
    all_day INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`)

  // ── 1. MEMORIES ─────────────────────────────────────────────────────────────
  console.log('📝 Memories aanmaken...')

  const memories = [
    { key: 'naam-en-leeftijd', value: 'Ik ben Daan Koolhaas, ±21 jaar, woon in Nederland', cat: 'profiel' },
    { key: 'werk-bouma', value: 'Werkvoorbereider bij Bouma Technisch Installatiebedrijf (4 dagen per week). Specialisatie: duurzame installaties, laadpalen, thuisbatterijen. Achtergrond als elektricien.', cat: 'werk' },
    { key: 'bedrijf-websup', value: 'Eigenaar van WebsUp.nl — webdesignbedrijf met focus op websites, webshops en maatwerk dashboards. Doel: binnen 6 maanden fulltime ondernemer zijn.', cat: 'ondernemerschap' },
    { key: 'toekomst-installaties', value: 'Tweede toekomstige focus: Koolhaas Installaties (eigen installatiebedrijf opbouwen)', cat: 'ondernemerschap' },
    { key: 'sterktes', value: 'Sterk in: technisch denken (IT + elektrotechniek), probleemoplossen, hands-on bouwen, snel resultaat boeken. Houdt van moeilijke opdrachten.', cat: 'profiel' },
    { key: 'aandachtspunten', value: 'Aandachtspunten: moeite met focus en te veel tegelijk doen, slaapritme niet optimaal (werkt te laat), soms uitstel bij afronden van projecten.', cat: 'profiel' },
    { key: 'werkstijl', value: 'Werkt avonden en weekenden aan eigen business. Houdt van snelheid en direct resultaat. Werkt praktisch i.p.v. theorie.', cat: 'profiel' },
    { key: 'klanten-aanpak', value: 'Klanten zijn geen nummers voor Daan. Persoonlijke aanpak is belangrijk. Wil schaalbare systemen bouwen.', cat: 'profiel' },
    { key: 'financieel-doel', value: 'Doel: financieel onafhankelijk worden als ondernemer binnen 6 maanden', cat: 'financieel' },
    { key: 'vriendin', value: 'Heeft een vriendin — kwaliteitsttijd op woensdagavond en in het weekend', cat: 'persoonlijk' },
  ]

  for (const m of memories) {
    await run(
      'INSERT OR REPLACE INTO memories (key, value, category) VALUES (?, ?, ?)',
      [m.key, m.value, m.cat]
    )
  }
  console.log(`  ✓ ${memories.length} memories`)

  // ── 2. CONTACTEN ─────────────────────────────────────────────────────────────
  console.log('👥 Contacten aanmaken...')

  const contacts = [
    { name: 'Mike', type: 'persoon', company: 'SYNC', notes: 'Klant maatwerk wastafels website' },
    { name: 'Jeremy Bouma', type: 'persoon', company: 'APK Media / Prime Animals', notes: 'Shopify webshop project' },
    { name: 'Shuly', type: 'persoon', company: 'Sjoeli', notes: 'Babyproducten webshop bijna klaar' },
    { name: 'Dick', type: 'persoon', company: 'Camperhulp', notes: 'WooCommerce webshop nieuw project' },
  ]

  const contactIds = {}
  for (const c of contacts) {
    // Check of contact al bestaat
    const existing = await run('SELECT id FROM contacts WHERE name = ?', [c.name])
    if (existing.rows.length > 0) {
      contactIds[c.name] = Number(existing.rows[0][0])
      console.log(`  ~ Contact "${c.name}" bestaat al (id: ${contactIds[c.name]})`)
      continue
    }
    const r = await run(
      "INSERT INTO contacts (name, type, company, notes, tags) VALUES (?, ?, ?, ?, '[]')",
      [c.name, c.type, c.company, c.notes]
    )
    contactIds[c.name] = Number(r.lastInsertRowid)
  }
  console.log(`  ✓ ${Object.keys(contactIds).length} contacten`)

  // ── 3. PROJECTEN ─────────────────────────────────────────────────────────────
  console.log('📦 Projecten aanmaken...')

  // Onze schema gebruikt 'actief' / 'on-hold' / 'afgerond' (Nederlands)
  const projects = [
    { title: 'WebsUp.nl', description: 'Eigen webdesignbedrijf — hoofdfocus. Websites, webshops, maatwerk dashboards.', status: 'actief', color: '#6172f3' },
    { title: 'Camperhulp webshop', description: 'Nieuwe WooCommerce webshop voor Camperhulp (Dick)', status: 'actief', color: '#f59e0b' },
    { title: 'Sjoeli webshop', description: 'Babyproducten webshop — bijna klaar voor lancering (Shuly)', status: 'actief', color: '#10b981' },
    { title: 'Camperrubbers', description: 'Webshop bijna live', status: 'actief', color: '#06b6d4' },
    { title: 'Prime Animals', description: 'Shopify webshop (Jeremy Bouma / APK Media)', status: 'actief', color: '#8b5cf6' },
    { title: 'SYNC website', description: 'Website voor maatwerk wastafels (Mike)', status: 'actief', color: '#ec4899' },
    { title: 'Kloppenburg vloerreiniging', description: 'Wacht op content van klant — geblokkeerd', status: 'on-hold', color: '#64748b' },
  ]

  const projectIds = {}
  for (const p of projects) {
    const existing = await run('SELECT id FROM projects WHERE title = ?', [p.title])
    if (existing.rows.length > 0) {
      projectIds[p.title] = Number(existing.rows[0][0])
      console.log(`  ~ Project "${p.title}" bestaat al`)
      continue
    }
    const r = await run(
      'INSERT INTO projects (title, description, status, color) VALUES (?, ?, ?, ?)',
      [p.title, p.description, p.status, p.color]
    )
    projectIds[p.title] = Number(r.lastInsertRowid)
  }
  console.log(`  ✓ ${Object.keys(projectIds).length} projecten`)

  // ── 4. GEWOONTES ──────────────────────────────────────────────────────────────
  console.log('🎯 Gewoontes aanmaken...')

  // Schema: frequency is 'dagelijks' of 'wekelijks' (niet 'ma-vr' etc.)
  const habits = [
    { name: 'Werk bij Bouma', icon: '🏢', frequency: 'dagelijks', description: 'Werkdag bij Bouma Technisch Installatiebedrijf' },
    { name: 'Aan WebsUp werken', icon: '💻', frequency: 'dagelijks', description: 'Avondsessie eigen business — minimaal 1 uur' },
    { name: 'Vrijdag focus dag WebsUp', icon: '🚀', frequency: 'wekelijks', description: 'Vrijdag volledig voor WebsUp reserveren' },
    { name: 'Kluswerk / installaties', icon: '🔧', frequency: 'wekelijks', description: 'Klussen of installatie werkzaamheden bijhouden' },
    { name: 'Tijd met vriendin', icon: '❤️', frequency: 'dagelijks', description: 'Woensdagavond + weekend kwaliteitsttijd' },
    { name: 'Op tijd naar bed', icon: '😴', frequency: 'dagelijks', description: 'Voor middernacht slapen — slaapritme verbeteren' },
  ]

  for (const h of habits) {
    const existing = await run('SELECT id FROM habits WHERE name = ?', [h.name])
    if (existing.rows.length > 0) {
      console.log(`  ~ Gewoonte "${h.name}" bestaat al`)
      continue
    }
    await run(
      'INSERT INTO habits (name, description, frequency, icon, color) VALUES (?, ?, ?, ?, ?)',
      [h.name, h.description, h.frequency, h.icon, '#6172f3']
    )
  }
  console.log(`  ✓ ${habits.length} gewoontes`)

  // ── 5. TODOS ─────────────────────────────────────────────────────────────────
  console.log('✅ Todos aanmaken...')

  // Schema: priority = 'hoog' / 'medium' / 'laag' (Nederlands, niet high/medium/low)
  const todos = [
    { title: 'Factuur sturen naar MCE voor hosting', priority: 'hoog', category: 'financieel', project: null, contact: null },
    { title: 'Prime Animals afronden en lanceren', priority: 'hoog', category: 'werk', project: 'Prime Animals', contact: 'Jeremy Bouma' },
    { title: 'Sjoeli webshop afronden en lanceren', priority: 'hoog', category: 'werk', project: 'Sjoeli webshop', contact: 'Shuly' },
    { title: 'Camperhulp meeting voorbereiden', priority: 'medium', category: 'werk', project: 'Camperhulp webshop', contact: 'Dick' },
    { title: 'SYNC meeting dinsdag voorbereiden', priority: 'medium', category: 'werk', project: 'SYNC website', contact: 'Mike' },
    { title: 'Kloppenburg — follow-up voor content', priority: 'laag', category: 'werk', project: 'Kloppenburg vloerreiniging', contact: null },
    { title: 'Slaapritme verbeteren — voor middernacht naar bed', priority: 'medium', category: 'persoonlijk', project: null, contact: null },
    { title: 'Groeistrategie WebsUp uitschrijven', priority: 'hoog', category: 'werk', project: 'WebsUp.nl', contact: null },
    { title: 'Camperrubbers webshop live zetten', priority: 'medium', category: 'werk', project: 'Camperrubbers', contact: null },
  ]

  for (const t of todos) {
    const existing = await run('SELECT id FROM todos WHERE title = ?', [t.title])
    if (existing.rows.length > 0) {
      console.log(`  ~ Todo "${t.title.slice(0, 40)}" bestaat al`)
      continue
    }
    await run(
      'INSERT INTO todos (title, priority, category, project_id, contact_id) VALUES (?, ?, ?, ?, ?)',
      [
        t.title,
        t.priority,
        t.category,
        t.project ? (projectIds[t.project] || null) : null,
        t.contact ? (contactIds[t.contact] || null) : null,
      ]
    )
  }
  console.log(`  ✓ ${todos.length} todos`)

  // ── 6. DAGBOEK VANDAAG ────────────────────────────────────────────────────────
  console.log('📖 Dagboek entry aanmaken...')

  const today = new Date().toISOString().split('T')[0]
  const existing = await run('SELECT id FROM journal_entries WHERE date = ?', [today])

  if (existing.rows.length === 0) {
    await run(
      `INSERT INTO journal_entries (date, content, mood, energy, highlights, gratitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        today,
        'Eerste dag met mijn persoonlijke AI-assistent. Druk met meerdere projecten tegelijk. Moet prioriteiten beter stellen en op tijd naar bed.',
        2, // stemming 2/5 (moe)
        2, // energie 2/5
        'WebsUp persoonlijke AI-app opgezet',
        JSON.stringify(['Eigen business bouwen', 'Technische skills combineren', 'Klanten blij maken']),
      ]
    )
    console.log('  ✓ Dagboek entry voor vandaag')
  } else {
    console.log('  ~ Dagboek entry voor vandaag bestaat al')
  }

  // ── 7. AGENDA EVENTS ──────────────────────────────────────────────────────────
  console.log('📅 Agenda events aanmaken...')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const nextTuesday = new Date()
  while (nextTuesday.getDay() !== 2) nextTuesday.setDate(nextTuesday.getDate() + 1)
  const nextTuesdayStr = nextTuesday.toISOString().split('T')[0]

  const nextFriday = new Date()
  while (nextFriday.getDay() !== 5) nextFriday.setDate(nextFriday.getDate() + 1)
  const nextFridayStr = nextFriday.toISOString().split('T')[0]

  const events = [
    { title: 'SYNC meeting', date: nextTuesdayStr, time: '10:00', type: 'vergadering', description: 'Website bespreking met Mike', contact: 'Mike', project: 'SYNC website' },
    { title: 'Camperhulp meeting', date: tomorrowStr, time: '14:00', type: 'vergadering', description: 'Project kick-off met Dick', contact: 'Dick', project: 'Camperhulp webshop' },
    { title: 'Vrijdag focus dag WebsUp', date: nextFridayStr, time: '09:00', type: 'algemeen', description: 'Volledige dag voor eigen business', contact: null, project: 'WebsUp.nl' },
  ]

  for (const e of events) {
    const existingEvent = await run('SELECT id FROM events WHERE title = ? AND date = ?', [e.title, e.date])
    if (existingEvent.rows.length > 0) {
      console.log(`  ~ Event "${e.title}" bestaat al`)
      continue
    }
    await run(
      'INSERT INTO events (title, description, date, time, type, contact_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [e.title, e.description, e.date, e.time, e.type, e.contact ? (contactIds[e.contact] || null) : null, e.project ? (projectIds[e.project] || null) : null]
    )
  }
  console.log(`  ✓ ${events.length} agenda events`)

  // ── KLAAR ────────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed compleet! Daan\'s data staat in de app.')
  console.log('   Open de app en vraag de AI: "Hoe sta ik ervoor?" om te testen.\n')

  db.close()
}

seed().catch(err => {
  console.error('\n❌ Seed mislukt:', err.message)
  process.exit(1)
})
