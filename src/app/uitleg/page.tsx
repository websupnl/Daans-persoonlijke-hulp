import AppShell from '@/components/layout/AppShell'
import { Sparkles, CheckSquare, FileText, Euro, Users, Activity, MessageSquare, CalendarDays, Brain, BookOpen } from 'lucide-react'

const modules = [
  {
    icon: <CheckSquare size={22} />,
    color: 'text-pink-500',
    title: 'Taken & Projecten',
    desc: 'Houd open taken bij met prioriteit en deadline. Koppel taken aan projecten en contacten zodat alles in context staat. De AI detecteert automatisch wanneer je achterloopt.',
  },
  {
    icon: <FileText size={22} />,
    color: 'text-orange-500',
    title: 'Notities',
    desc: 'Snel ideeën, afspraken of aantekeningen vastleggen. Doorzoekbaar en koppelbaar aan projecten en contacten.',
  },
  {
    icon: <Euro size={22} />,
    color: 'text-emerald-500',
    title: 'Financiën',
    desc: 'Inkomsten en uitgaven bijhouden voor zowel privé als zakelijk. Importeer rechtstreeks vanuit je bankafschrift (ING, Rabobank, ABN AMRO). Bulkverwijdering per rekening mogelijk.',
  },
  {
    icon: <Users size={22} />,
    color: 'text-blue-500',
    title: 'Contacten',
    desc: 'Overzicht van klanten, leveranciers en relaties. Koppel contacten aan taken, facturen en projecten voor een compleet beeld.',
  },
  {
    icon: <Activity size={22} />,
    color: 'text-purple-500',
    title: 'Gewoontes',
    desc: 'Dagelijkse en wekelijkse routines bijhouden met een 7-daags overzicht en streak-teller. De proactieve AI stuurt een Telegram-melding als je een patroon doorbreekt.',
  },
  {
    icon: <BookOpen size={22} />,
    color: 'text-amber-500',
    title: 'Dagboek',
    desc: 'Dagelijkse reflectie met stemming (1-5), energieniveau en dankbaarheidslijst. AI analyseert patronen en stelt gerichte vervolgvragen.',
  },
  {
    icon: <CalendarDays size={22} />,
    color: 'text-teal-500',
    title: 'Agenda',
    desc: 'Weekoverzicht van afspraken, deadlines en taken. Voeg evenementen toe en zie direct wat er vandaag op de planning staat.',
  },
  {
    icon: <MessageSquare size={22} />,
    color: 'text-pink-400',
    title: 'Chat & Telegram',
    desc: 'Praat direct met de AI via de app of via Telegram. Voeg taken toe, vraag om een samenvatting of laat de AI een rapport sturen — in gewone taal.',
  },
  {
    icon: <Brain size={22} />,
    color: 'text-violet-500',
    title: 'Proactieve AI',
    desc: 'De app analyseert elk uur je data en stuurt een Telegram-bericht wanneer er iets opvalt: achterstallige taken, lang geen journaalinvoer, of financiële stilte. Geen push-notificaties op je telefoon nodig.',
  },
]

export default function UitlegPage() {
  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-4xl">
        <div className="mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg mb-4" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}>
            <Sparkles size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gradient mb-2">
            Persoonlijk Brein — Hoe werkt het?
          </h1>
          <p className="text-gray-500 text-base max-w-2xl leading-relaxed">
            Een centrale plek voor taken, financiën, gewoontes en reflectie — aangedreven door AI die je leven actief bijhoudt en proactief signaleert wanneer er iets aandacht vraagt.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {modules.map((m) => (
            <div key={m.title} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`flex items-center gap-3 mb-2 ${m.color}`}>
                {m.icon}
                <h2 className="text-base font-bold text-gray-800">{m.title}</h2>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 rounded-2xl p-6 border border-pink-100">
          <h2 className="text-lg font-bold text-gradient mb-2">Hoe de AI werkt</h2>
          <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
            <p><strong className="text-gray-700">Tier 1 — Sentry:</strong> Elk uur controleert het systeem op afwijkingen in je data (geen financiële invoer, overdue taken, gebroken streaks, dalende stemming).</p>
            <p><strong className="text-gray-700">Tier 2 — Sage:</strong> Als er een anomalie is, schrijft GPT-4o een beknopt, persoonlijk Telegram-bericht met een concrete actievraag.</p>
            <p><strong className="text-gray-700">Memory:</strong> De AI bouwt langetermijn-theorieën op over jouw patronen en gebruikt die om inzichten te personaliseren.</p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
