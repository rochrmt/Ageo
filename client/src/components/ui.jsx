import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react'

/* ── Modal ──────────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, icon: Icon, children, size = 'md' }) {
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className={`card w-full ${widths[size]} my-4`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Icon size={18} />
              </span>
            )}
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ── Carte statistique ──────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const colors = {
    brand:  'bg-brand-600 text-white',
    green:  'bg-emerald-500 text-white',
    orange: 'bg-amber-500 text-white',
    purple: 'bg-violet-600 text-white',
    slate:  'bg-slate-100 text-slate-500',
  }
  return (
    <div className="stat-card">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      </div>
      {Icon && (
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${colors[color]}`}>
          <Icon size={20} />
        </span>
      )}
    </div>
  )
}

/* ── Badge de statut ────────────────────────────────────────────────────── */
const STATUS_STYLES = {
  actif: 'bg-emerald-100 text-emerald-700',
  inactif: 'bg-slate-100 text-slate-500',
  en_attente: 'bg-amber-100 text-amber-700',
  en_cours: 'bg-brand-100 text-brand-700',
  livree: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-red-100 text-red-700',
  brouillon: 'bg-slate-100 text-slate-600',
  emise: 'bg-brand-100 text-brand-700',
  partielle: 'bg-amber-100 text-amber-700',
  payee: 'bg-emerald-100 text-emerald-700',
  paye: 'bg-emerald-100 text-emerald-700',
  approuve: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-red-100 text-red-700',
}
const STATUS_LABELS = {
  en_attente: 'En attente', en_cours: 'En cours', livree: 'Livrée', annulee: 'Annulée',
  brouillon: 'Brouillon', emise: 'Émise', partielle: 'Partielle', payee: 'Payée',
  paye: 'Payé', approuve: 'Approuvé', refuse: 'Refusé', actif: 'Actif', inactif: 'Inactif',
}
export function Badge({ status, children }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return <span className={`badge ${cls}`}>{children || STATUS_LABELS[status] || status}</span>
}

/* ── État vide ──────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {Icon && <Icon size={44} className="text-slate-300" />}
      <p className="text-slate-500">{title}</p>
      {action}
    </div>
  )
}

/* ── Spinner ────────────────────────────────────────────────────────────── */
export function Spinner({ label = 'Chargement...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */
const ToastContext = createContext(null)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((type, message) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  const toast = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info }
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
  }
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${styles[t.type]}`}>
              <Icon size={18} />
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
export const useToast = () => useContext(ToastContext)
