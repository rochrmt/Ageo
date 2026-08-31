import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Package, ShoppingCart, TrendingUp, Wallet,
  FileText, BarChart3, Settings, UserCog, ScrollText, Search, Bell,
  LogOut, X, Menu, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/Auth'
import { useSettings } from '../context/Settings'
import api from '../lib/api'

const NAV = [
  { to: '/',            label: 'Tableau de bord', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/clients',     label: 'Clients',         icon: Users,          key: 'clients' },
  { to: '/produits',    label: 'Produits',        icon: Package,        key: 'produits' },
  { to: '/commandes',   label: 'Commandes',       icon: ShoppingCart,   key: 'commandes' },
  { to: '/ventes',      label: 'Ventes',          icon: TrendingUp,     key: 'ventes' },
  { to: '/caisse',      label: 'Caisse',          icon: Wallet,         key: 'caisse' },
  { to: '/facturation', label: 'Facturation',     icon: FileText,       key: 'facturation' },
  { to: '/personnel',   label: 'Personnel',       icon: UserCog,        key: 'personnel' },
  { to: '/rapports',    label: 'Rapports',        icon: BarChart3,      key: 'rapports' },
  { to: '/journal',     label: "Journal",         icon: ScrollText,     key: 'journal' },
]

const TITLES = {
  '/': 'Tableau de bord', '/clients': 'Gestion des clients', '/produits': 'Catalogue produits',
  '/commandes': 'Gestion des commandes', '/ventes': 'Ventes', '/caisse': 'Caisse',
  '/facturation': 'Facturation', '/personnel': 'Gestion du personnel', '/rapports': 'Rapports & Statistiques',
  '/journal': "Journal d'activité", '/parametres': 'Paramètres',
}

export default function Layout() {
  const { user, logout, hasModule, isAdmin } = useAuth()
  const { appName, settings } = useSettings()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = TITLES[location.pathname] || Object.entries(TITLES)
    .find(([p]) => p !== '/' && location.pathname.startsWith(p))?.[1] || appName

  const visibleNav = NAV.filter((n) => hasModule(n.key))
  const initial = (user?.nom || user?.username || '?').charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex-col bg-sidebar text-slate-300
        transition-transform lg:static lg:flex ${mobileOpen ? 'flex translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-brand-600 text-lg font-bold text-white">
            {settings.logo
              ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" />
              : (appName.charAt(0).toUpperCase())}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">{appName}</p>
            {settings.editeur && <p className="truncate text-xs text-slate-400">par {settings.editeur}</p>}
          </div>
        </div>

        <p className="px-5 pb-2 pt-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Navigation</p>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                 ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-sidebar-hover hover:text-white'}`}>
              <n.icon size={19} />
              {n.label}
            </NavLink>
          ))}

          {(isAdmin || hasModule('parametres')) && (
            <>
              <div className="my-2 border-t border-slate-600/60" />
              <NavLink to="/parametres" onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                   ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-sidebar-hover hover:text-white'}`}>
                <Settings size={19} />
                Paramètres
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 border-t border-slate-600/60 px-4 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.nom}</p>
            <p className="truncate text-xs text-slate-400">{appName}</p>
          </div>
          <button onClick={logout} title="Déconnexion"
            className="rounded-lg p-2 text-slate-400 hover:bg-sidebar-hover hover:text-white">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
          <h1 className="flex-1 truncate text-lg font-bold text-slate-900">{title}</h1>
          <GlobalSearch />
          <Notifications />
        </header>
        <LicenceBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/* ── Bannière d'alerte licence ─────────────────────────────────────────── */
function LicenceBanner() {
  const [info, setInfo] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/licence/info').then(({ data }) => setInfo(data)).catch(() => setInfo(null))
  }, [])

  if (!info || dismissed) return null

  const daysLeft = info.jours_restants
  const isExpired = !info.valid && info.expired
  const isWarning = info.valid && daysLeft != null && daysLeft <= 30

  if (!isExpired && !isWarning) return null

  const couleur = isExpired
    ? 'bg-red-600 text-white'
    : daysLeft <= 7
      ? 'bg-red-500 text-white'
      : 'bg-amber-500 text-white'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 sm:px-6 ${couleur}`}>
      <AlertTriangle size={18} className="shrink-0" />
      <p className="flex-1 text-sm font-medium">
        {isExpired
          ? `Licence expirée le ${info.expiration}. L'application sera bientôt bloquée.`
          : `Licence expire dans ${daysLeft} jour(s) (${info.expiration}). Pensez à la renouveler.`}
      </p>
      <Link to="/parametres" className="rounded-md bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30">
        Renouveler
      </Link>
      <button onClick={() => setDismissed(true)} className="rounded-md p-1 hover:bg-white/20">
        <X size={16} />
      </button>
    </div>
  )
}

/* ── Recherche globale (Ctrl+K) ─────────────────────────────────────────── */
function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  useEffect(() => {
    if (!q.trim()) { setResults(null); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q } })
        setResults(data)
      } catch { setResults(null) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const go = (path) => { setOpen(false); setQ(''); setResults(null); navigate(path) }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400 hover:bg-slate-200 sm:flex sm:w-72">
        <Search size={16} />
        <span className="flex-1 text-left">Rechercher...</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">Ctrl+K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:hidden">
        <Search size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-24" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un client, produit, commande, facture..."
                className="flex-1 text-sm outline-none" />
              <button onClick={() => setOpen(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!results && <p className="px-3 py-6 text-center text-sm text-slate-400">Tapez pour rechercher…</p>}
              {results && (
                <SearchResults results={results} go={go} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SearchResults({ results, go }) {
  const groups = [
    { key: 'clients', label: 'Clients', path: '/clients', render: (r) => r.nom },
    { key: 'produits', label: 'Produits', path: '/produits', render: (r) => r.nom },
    { key: 'commandes', label: 'Commandes', path: '/commandes', render: (r) => `${r.numero} · ${r.client_nom || ''}` },
    { key: 'factures', label: 'Factures', path: '/facturation', render: (r) => `${r.numero} · ${r.client_nom || ''}` },
  ]
  const empty = groups.every((g) => !results[g.key]?.length)
  if (empty) return <p className="px-3 py-6 text-center text-sm text-slate-400">Aucun résultat</p>
  return groups.map((g) => (results[g.key]?.length ? (
    <div key={g.key} className="mb-2">
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
      {results[g.key].map((r) => (
        <button key={r.id} onClick={() => go(g.path)}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100">
          {g.render(r)}
        </button>
      ))}
    </div>
  ) : null))
}

/* ── Notifications ──────────────────────────────────────────────────────── */
function Notifications() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ count: 0, alertes: [] })
  const navigate = useNavigate()

  const load = async () => {
    try { const { data } = await api.get('/notifications'); setData(data) } catch { /* ignore */ }
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])

  const niveaux = {
    danger: 'border-l-red-500 bg-red-50', warning: 'border-l-amber-500 bg-amber-50', info: 'border-l-brand-500 bg-brand-50',
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        <Bell size={20} />
        {data.count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {data.count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-900"><Bell size={16} /> Notifications</div>
              <button onClick={() => setOpen(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.alertes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Bell size={24} /></span>
                  <p className="font-semibold text-slate-800">Tout va bien !</p>
                  <p className="text-sm text-slate-400">Aucune alerte en cours.</p>
                </div>
              ) : data.alertes.map((a, i) => (
                <button key={i} onClick={() => { setOpen(false); navigate(a.lien) }}
                  className={`block w-full border-l-4 px-4 py-3 text-left hover:brightness-95 ${niveaux[a.niveau] || niveaux.info}`}>
                  <p className="text-sm font-semibold text-slate-800">{a.titre}</p>
                  <p className="text-xs text-slate-600">{a.message}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
