import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, ShoppingCart, Users, Package, TrendingUp, RefreshCw, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { StatCard, Badge, Spinner } from '../components/ui'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export default function Dashboard() {
  const { devise } = useSettings()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/dashboard'); setData(data) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading) return <Spinner />
  if (!data) return null

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const chart = (data.evolution || []).map((e) => {
    const [y, m] = e.mois.split('-')
    return { mois: MONTHS[parseInt(m, 10) - 1], ca: e.ca }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm capitalize text-slate-500">{today}</p>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700">
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="CA du mois" value={formatMoney(data.ca_mois, devise)} icon={Wallet} color="brand"
          sub={<span className={data.ca_variation >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {data.ca_variation >= 0 ? '+' : ''}{data.ca_variation}% vs mois précédent</span>} />
        <StatCard label="Commandes actives" value={data.commandes_actives} icon={ShoppingCart} color="purple"
          sub="En attente ou en cours" />
        <StatCard label="Clients actifs" value={data.clients_actifs} icon={Users} color="green" sub="Ce mois-ci" />
        <StatCard label="Produits en stock" value={data.produits_stock} icon={Package} color="orange" sub="Unités disponibles" />
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-900">Évolution du chiffre d'affaires</h2>
        <p className="mb-4 text-sm text-slate-400">6 derniers mois</p>
        <div className="h-72">
          {chart.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">Aucune donnée pour cette période</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatMoney(v, devise)} />
                <Area type="monotone" dataKey="ca" stroke="#2563eb" strokeWidth={2} fill="url(#ca)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Top clients</h2>
        {data.top_clients.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {data.top_clients.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
                <span className="flex-1 font-medium text-slate-800">{c.nom}</span>
                <span className="font-semibold text-slate-900">{formatMoney(c.ca, devise)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Commandes récentes</h2>
          <Link to="/commandes" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
            Voir tout <ArrowRight size={15} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">N° Commande</th><th className="table-th">Client</th>
                <th className="table-th">Date</th><th className="table-th text-right">Montant</th>
                <th className="table-th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.commandes_recentes.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Aucune commande</td></tr>
              ) : data.commandes_recentes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="table-td font-semibold text-slate-900">{c.numero}</td>
                  <td className="table-td">{c.client_nom || '—'}</td>
                  <td className="table-td text-slate-500">{formatDate(c.date_commande)}</td>
                  <td className="table-td text-right font-semibold">{formatMoney(c.montant_ht, devise)}</td>
                  <td className="table-td"><Badge status={c.statut} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
