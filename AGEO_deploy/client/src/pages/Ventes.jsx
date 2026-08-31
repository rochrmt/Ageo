import { useState, useEffect } from 'react'
import { ShoppingBag, DollarSign, Users, Award } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import api, { formatMoney } from '../lib/api'
import { useSettings } from '../context/Settings'
import { Spinner } from '../components/ui'

const PERIODES = [
  { key: 'semaine', label: 'Semaine' }, { key: 'mois', label: 'Mois' },
  { key: 'trimestre', label: 'Trimestre' }, { key: 'annee', label: 'Année' },
]

export default function Ventes() {
  const { devise } = useSettings()
  const [periode, setPeriode] = useState('mois')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get('/ventes', { params: { periode } })
      .then(({ data }) => { if (alive) setData(data) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [periode])

  const cards = data ? [
    { label: 'Chiffre d\'affaires', value: formatMoney(data.ca, devise), icon: ShoppingBag, color: 'bg-brand-100 text-brand-600' },
    { label: 'Commandes livrées', value: data.commandes, icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Clients uniques', value: data.clients, icon: Users, color: 'bg-violet-100 text-violet-600' },
    { label: 'Panier moyen', value: formatMoney(data.panier_moyen, devise), icon: Award, color: 'bg-amber-100 text-amber-600' },
  ] : []

  const chart = (data?.evolution || []).map((e) => ({
    jour: e.jour.slice(5), ca: e.ca,
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Ventes</h2>
          <p className="text-sm text-slate-400">vs période précédente</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {PERIODES.map((p) => (
            <button key={p.key} onClick={() => setPeriode(p.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition
                ${periode === p.key ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="card p-5">
                <span className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${c.color}`}><c.icon size={18} /></span>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-sm text-slate-400">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="mb-4 font-bold text-slate-900">Évolution du CA</h3>
            <div className="h-80">
              {chart.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-slate-400">Aucune donnée pour cette période</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatMoney(v, devise)} />
                    <Bar dataKey="ca" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
