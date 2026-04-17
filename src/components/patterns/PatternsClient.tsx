'use client'

import { useEffect, useState } from 'react'
import { 
  Brain, CheckCircle2, HelpCircle, Lightbulb, 
  BarChart3, RefreshCcw, TrendingUp, AlertTriangle,
  ChevronRight, Calendar, Info, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Pattern = {
  id: number
  category: string
  theory: string
  confidence: number
  status: 'hypothesis' | 'confirmed' | 'dismissed'
  impact_score: number
  source_modules: string[]
  action_potential: string | null
  supporting_data: string | null
  updated_at: string
}

type Question = {
  id: number
  source_module: string
  question: string
  rationale: string | null
  status: 'pending' | 'sent' | 'answered' | 'dismissed'
  priority: number
  confidence: number
  impact_score: number
  created_at: string
}

type Observation = {
  obs_date: string
  module: string
  metric_key: string
  metric_value: number
  metric_text: string | null
}

export default function PatternsClient() {
  const [activeTab, setActiveTab] = useState<'confirmed' | 'hypothesis' | 'questions' | 'opportunities' | 'viz'>('confirmed')
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/patterns')
      const data = await res.json()
      setPatterns(data.patterns || [])
      setQuestions(data.questions || [])
      setObservations(data.observations || [])
    } catch (err) {
      console.error('Failed to fetch patterns:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      await fetch('/api/patterns', {
        method: 'POST',
        body: JSON.stringify({ action: 'analyze' })
      })
      await fetchData()
    } catch (err) {
      console.error('Analysis failed:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  const updatePattern = async (id: number, action: 'confirm' | 'dismiss') => {
    try {
      await fetch('/api/patterns', {
        method: 'POST',
        body: JSON.stringify({ id, action })
      })
      await fetchData()
    } catch (err) {
      console.error('Update failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const confirmed = patterns.filter(p => p.status === 'confirmed')
  const hypotheses = patterns.filter(p => p.status === 'hypothesis')
  const openQuestions = questions.filter(q => q.status === 'pending' || q.status === 'sent')
  const opportunities = patterns.filter(p => p.action_potential)

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient leading-tight flex items-center gap-3">
            <Brain className="text-pink-500" />
            Patronen & Signalen
          </h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">De AI-engine die jouw gedrag en routines begrijpt.</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 text-sm font-bold"
        >
          <RefreshCcw size={16} className={analyzing ? 'animate-spin' : ''} />
          {analyzing ? 'Analyseren...' : 'Nu Analyseren'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 no-scrollbar pb-2">
        <TabButton 
          active={activeTab === 'confirmed'} 
          onClick={() => setActiveTab('confirmed')}
          icon={<CheckCircle2 size={16} />}
          label="Bevestigd"
          count={confirmed.length}
        />
        <TabButton 
          active={activeTab === 'hypothesis'} 
          onClick={() => setActiveTab('hypothesis')}
          icon={<Brain size={16} />}
          label="Hypotheses"
          count={hypotheses.length}
        />
        <TabButton 
          active={activeTab === 'questions'} 
          onClick={() => setActiveTab('questions')}
          icon={<HelpCircle size={16} />}
          label="Vragen"
          count={openQuestions.length}
        />
        <TabButton 
          active={activeTab === 'opportunities'} 
          onClick={() => setActiveTab('opportunities')}
          icon={<Lightbulb size={16} />}
          label="Kansen"
          count={opportunities.length}
        />
        <TabButton 
          active={activeTab === 'viz'} 
          onClick={() => setActiveTab('viz')}
          icon={<BarChart3 size={16} />}
          label="Visualisaties"
        />
      </div>

      <div className="space-y-6">
        {activeTab === 'confirmed' && (
          <div className="grid grid-cols-1 gap-4">
            {confirmed.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} text="Nog geen bevestigde patronen. Reageer op hypotheses om ze te bevestigen." />
            ) : (
              confirmed.map(p => <PatternCard key={p.id} pattern={p} />)
            )}
          </div>
        )}

        {activeTab === 'hypothesis' && (
          <div className="grid grid-cols-1 gap-4">
            {hypotheses.length === 0 ? (
              <EmptyState icon={<Brain />} text="Geen actieve hypotheses op dit moment." />
            ) : (
              hypotheses.map(p => (
                <PatternCard 
                  key={p.id} 
                  pattern={p} 
                  onConfirm={() => updatePattern(p.id, 'confirm')}
                  onDismiss={() => updatePattern(p.id, 'dismiss')}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="grid grid-cols-1 gap-4">
            {openQuestions.length === 0 ? (
              <EmptyState icon={<HelpCircle />} text="Geen openstaande vragen. De AI is momenteel tevreden met wat ze weet." />
            ) : (
              openQuestions.map(q => <QuestionCard key={q.id} question={q} />)
            )}
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="grid grid-cols-1 gap-4">
            {opportunities.length === 0 ? (
              <EmptyState icon={<Lightbulb />} text="Nog geen kansen of besparingen geïdentificeerd." />
            ) : (
              opportunities.map(p => <OpportunityCard key={p.id} pattern={p} />)
            )}
          </div>
        )}

        {activeTab === 'viz' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <VizMoodVsExpenses observations={observations} />
            <VizWorkRoutine observations={observations} />
            <VizHabitConsistency observations={observations} />
            <VizAnomalyLog observations={observations} />
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label, count }: { 
  active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
        active 
          ? "bg-white border border-pink-100 text-pink-600 shadow-sm" 
          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px]",
          active ? "bg-pink-100 text-pink-600" : "bg-gray-100 text-gray-400"
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

function PatternCard({ pattern, onConfirm, onDismiss }: { 
  pattern: Pattern, onConfirm?: () => void, onDismiss?: () => void 
}) {
  const categories: Record<string, string> = {
    financieel_gedrag: 'Financieel',
    productiviteit: 'Productiviteit',
    emotioneel_patroon: 'Emotioneel',
    gewoonte: 'Gewoontes',
    werk_privé: 'Werk/Privé',
    afwezigheid_signaal: 'Afwezigheid'
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500 bg-pink-50 px-2 py-1 rounded-lg">
              {categories[pattern.category] || pattern.category}
            </span>
            <span className="text-[10px] font-bold text-gray-400">
              Confidence: {Math.round(pattern.confidence * 100)}%
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2 leading-snug">
            {pattern.theory}
          </h3>
          {pattern.supporting_data && (
            <p className="text-sm text-gray-500 mb-4 bg-gray-50 p-3 rounded-xl border-l-2 border-gray-200 italic">
              &quot;{pattern.supporting_data}&quot;
            </p>
          )}
          
          <div className="flex flex-wrap gap-2">
            {pattern.source_modules.map(mod => (
              <span key={mod} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize font-medium">
                {mod}
              </span>
            ))}
          </div>
        </div>

        <div className="md:w-48 flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
              <span>Impact</span>
              <span>{Math.round(pattern.impact_score * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-pink-500 to-violet-500" 
                style={{ width: `${pattern.impact_score * 100}%` }}
              />
            </div>
          </div>

          {onConfirm && onDismiss && (
            <div className="flex gap-2 mt-auto">
              <button 
                onClick={onConfirm}
                className="flex-1 py-2 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors"
              >
                Klopt
              </button>
              <button 
                onClick={onDismiss}
                className="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors"
              >
                Niet waar
              </button>
            </div>
          )}
          
          {pattern.status === 'confirmed' && (
            <div className="mt-auto flex items-center gap-1.5 text-emerald-500 font-bold text-xs bg-emerald-50 px-3 py-2 rounded-xl justify-center">
              <CheckCircle2 size={12} />
              Bevestigd
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuestionCard({ question }: { question: Question }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 flex-shrink-0">
          <HelpCircle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded-lg capitalize">
              {question.source_module}
            </span>
            <span className="text-[10px] font-bold text-gray-400">
              Prioriteit: {question.priority}
            </span>
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-2">
            {question.question}
          </h3>
          {question.rationale && (
            <p className="text-xs text-gray-500 italic">
              Rationale: {question.rationale}
            </p>
          )}
        </div>
        <button className="self-center px-4 py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition-colors">
          Beantwoorden
        </button>
      </div>
    </div>
  )
}

function OpportunityCard({ pattern }: { pattern: Pattern }) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-white rounded-3xl border border-violet-100 p-6 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Lightbulb size={100} className="text-violet-500" />
      </div>
      <div className="relative z-10 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0">
          <Zap size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Kans gedetecteerd</h3>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            {pattern.action_potential}
          </p>
          <div className="p-3 bg-white/50 rounded-xl border border-violet-100/50">
            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Gebaseerd op patroon</p>
            <p className="text-xs font-bold text-gray-700">{pattern.theory}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
      <div className="inline-flex w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center text-gray-400 mb-4">
        {icon}
      </div>
      <p className="text-gray-500 font-medium">{text}</p>
    </div>
  )
}

// Simple Visualization Components
function VizMoodVsExpenses({ observations }: { observations: Observation[] }) {
  // Try to find mood and expense data
  const moodData = observations.filter(o => o.module === 'journal' && o.metric_key === 'mood')
  const expenseData = observations.filter(o => o.module === 'finance' && o.metric_key === 'total_expenses')
  
  // Create a combined list for the last 14 days
  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dateStr = d.toISOString().split('T')[0]
    
    const mood = moodData.find(o => o.obs_date.startsWith(dateStr))?.metric_value || 0
    const expense = expenseData.find(o => o.obs_date.startsWith(dateStr))?.metric_value || 0
    
    return { date: dateStr, mood, expense }
  })

  const maxExpense = Math.max(...last14Days.map(d => d.expense), 100)

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-pink-500" />
        Stemming vs. Uitgaven (Laatste 14 dagen)
      </h3>
      <div className="h-40 flex items-end gap-1 px-2">
        {last14Days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Bar for expenses */}
            <div 
              className="w-full bg-pink-100 rounded-t-sm group-hover:bg-pink-200 transition-colors relative" 
              style={{ height: `${(d.expense / maxExpense) * 100}%`, minHeight: d.expense > 0 ? '4px' : '0' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[8px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">
                €{d.expense.toFixed(0)} / Stemming: {d.mood || '?'}
              </div>
            </div>
            {/* Dot representing mood */}
            {d.mood > 0 && (
              <div 
                className="absolute w-2 h-2 rounded-full bg-violet-500 border border-white shadow-sm z-10" 
                style={{ bottom: `${(d.mood / 5) * 100}%`, left: '50%', transform: 'translateX(-50%)' }} 
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
        <span>{last14Days[0].date}</span>
        <span>Vandaag</span>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[9px] font-bold uppercase tracking-wider text-gray-400">
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-pink-200" /> Uitgaven</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500" /> Stemming</div>
      </div>
    </div>
  )
}

function VizWorkRoutine({ observations }: { observations: Observation[] }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar size={16} className="text-violet-500" />
        Werkritme per Weekdag
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
          <div key={d} className="flex flex-col items-center gap-2">
            <div className="w-full aspect-square rounded-lg bg-violet-50 flex items-center justify-center">
              <div className="w-3/4 h-3/4 rounded-md bg-violet-500 opacity-20" style={{ opacity: d === 'Vr' ? 0.8 : 0.4 }} />
            </div>
            <span className="text-[10px] font-bold text-gray-400">{d}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-4 italic text-center">
        Donkere kleur = hogere activiteit (WebsUp piek op vrijdag)
      </p>
    </div>
  )
}

function VizHabitConsistency({ observations }: { observations: Observation[] }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Brain size={16} className="text-emerald-500" />
        Consistency Heatmap
      </h3>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "w-4 h-4 rounded-sm transition-colors hover:scale-110",
              i % 7 === 0 ? "bg-emerald-500" : 
              i % 5 === 0 ? "bg-emerald-300" :
              i % 3 === 0 ? "bg-emerald-100" : "bg-gray-100"
            )}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase">
          <div className="w-2 h-2 rounded-sm bg-gray-100" /> Laag
          <div className="w-2 h-2 rounded-sm bg-emerald-500 ml-2" /> Hoog
        </div>
      </div>
    </div>
  )
}

function VizAnomalyLog({ observations }: { observations: Observation[] }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm overflow-hidden">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 px-1">
        <AlertTriangle size={16} className="text-amber-500" />
        Afwijkingen Queue
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-700 truncate">€200 bij Jumbo (cash?)</p>
            <p className="text-[10px] text-gray-400">Gisteren · Ongebruikelijk bedrag</p>
          </div>
          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
        </div>
        <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
          <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-700 truncate">Werklog ontbreekt (vrijdag)</p>
            <p className="text-[10px] text-gray-400">Vandaag · Afwijking routine</p>
          </div>
          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
        </div>
      </div>
    </div>
  )
}
