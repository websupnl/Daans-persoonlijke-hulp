import AppShell from '@/components/layout/AppShell'
import { Sparkles, CheckSquare, FileText, Euro, Users, Activity, MessageSquare, CalendarDays } from 'lucide-react'

export default function UitlegPage() {
  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-4xl">
        <div className="mb-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg mb-4" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}>
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gradient mb-2">
            Wat is dit voor een app?
          </h1>
          <p className="text-gray-500 text-lg">De super-hulp van Daan, simpel uitgelegd!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3 text-pink-500">
              <CheckSquare size={24} />
              <h2 className="text-xl font-bold">Lijstjes maken</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Heb je huiswerk of moet je je kamer opruimen? De app helpt je onthouden wat je nog moet doen. Als je klaar bent, zet je een vinkje. Dat voelt super goed!
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3 text-orange-500">
              <FileText size={24} />
              <h2 className="text-xl font-bold">Briefjes schrijven</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Heb je een goed idee of wil je iets niet vergeten? Schrijf het snel op op een digitaal briefje. Zo raak je je ideeën nooit meer kwijt!
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3 text-emerald-500">
              <Euro size={24} />
              <h2 className="text-xl font-bold">Centjes tellen</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              De app houdt bij hoeveel geld er binnenkomt en hoeveel je uitgeeft aan snoepjes of speelgoed. Zo weet je altijd of je nog genoeg hebt voor iets nieuws!
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3 text-blue-500">
              <Users size={24} />
              <h2 className="text-xl font-bold">Vriendjes en familie</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Alle namen en nummers van je vriendjes en familie staan handig bij elkaar. Zo kun je ze makkelijk vinden als je ze wilt bellen.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3 text-purple-500">
              <Activity size={24} />
              <h2 className="text-xl font-bold">Goede gewoontes</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Wil je elke dag een appel eten of goed je tanden poetsen? De app geeft je elke dag een sticker als het is gelukt. Zo leer je super-goede dingen!
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3 text-pink-400">
              <MessageSquare size={24} />
              <h2 className="text-xl font-bold">Praten met de computer</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Er zit een slimme robot in de app. Je kunt hem vragen stellen zoals: &quot;Wat moet ik vandaag doen?&quot; en hij geeft je meteen antwoord!
            </p>
          </div>
        </div>

        <div className="mt-12 bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 rounded-3xl p-8 border border-pink-100 text-center">
          <h2 className="text-2xl font-bold text-gradient mb-4 flex items-center justify-center gap-2">
            <CalendarDays className="text-pink-500" />
            Nog veel meer!
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            De app heeft ook een agenda, een dagboek voor je geheimen en een plek voor al je grote plannen. Het is het geheime wapen van Daan om een echte superheld te worden! 🦸‍♂️✨
          </p>
        </div>
      </div>
    </AppShell>
  )
}
