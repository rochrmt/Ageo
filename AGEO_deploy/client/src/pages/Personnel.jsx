import { useState, useEffect, useMemo } from 'react'
import {
  Users, Calendar, Wallet, UserPlus, Search, CheckCircle2, Clock, Save,
  ChevronLeft, ChevronRight, RefreshCw, Printer, Check, X, Trash2,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Badge, Modal, Spinner, EmptyState, useToast } from '../components/ui'

const TABS = [
  { key: 'employes', label: 'Employés', icon: Users },
  { key: 'conges', label: 'Congés & Absences', icon: Calendar },
  { key: 'paie', label: 'Paie', icon: Wallet },
]

export default function Personnel() {
  const [tab, setTab] = useState('employes')
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
              ${tab === t.key ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'employes' && <Employes />}
      {tab === 'conges' && <Conges />}
      {tab === 'paie' && <Paie />}
    </div>
  )
}

/* ── Employés ───────────────────────────────────────────────────────────── */
const EMPTY_EMP = { nom: '', prenom: '', poste: '', departement: '', telephone: '', email: '', date_embauche: '', salaire: '' }
function Employes() {
  const { devise } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [employes, setEmployes] = useState([])
  const [departements, setDepartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dep, setDep] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_EMP)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [e, d] = await Promise.all([api.get('/employes'), api.get('/departements')])
      setEmployes(e.data); setDepartements(d.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return employes.filter((e) => {
      const okQ = !s || [e.nom, e.prenom, e.poste, e.departement].some((v) => (v || '').toLowerCase().includes(s))
      const okD = !dep || e.departement === dep
      return okQ && okD
    })
  }, [employes, q, dep])

  const stats = useMemo(() => ({
    total: employes.length,
    actifs: employes.filter((e) => e.actif).length,
    masse: employes.filter((e) => e.actif).reduce((s, e) => s + (e.salaire || 0), 0),
  }), [employes])

  const openNew = () => { setForm(EMPTY_EMP); setEditing(null); setModal(true) }
  const openEdit = (e) => {
    setForm({ nom: e.nom, prenom: e.prenom || '', poste: e.poste || '', departement: e.departement || '',
      telephone: e.telephone || '', email: e.email || '', date_embauche: e.date_embauche?.slice(0, 10) || '', salaire: e.salaire })
    setEditing(e); setModal(true)
  }
  const submit = async (ev) => {
    ev.preventDefault()
    try {
      if (editing) { await api.put(`/employes/${editing.id}`, { ...form, actif: editing.actif }); toast.success('Employé modifié') }
      else { await api.post('/employes', form); toast.success('Employé créé') }
      setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const remove = async (e) => {
    if (!confirm(`Supprimer ${e.nom} ${e.prenom || ''} ?`)) return
    try { await api.delete(`/employes/${e.id}`); toast.success('Employé supprimé'); load() } catch { toast.error('Erreur') }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employés" value={stats.total} icon={Users} color="slate" />
        <StatCard label="Actifs" value={stats.actifs} icon={CheckCircle2} color="green" />
        <StatCard label="Congés en attente" value={0} icon={Clock} color="orange" />
        <StatCard label="Masse salariale" value={formatMoney(stats.masse, devise)} icon={Wallet} color="brand" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Nom, poste, département..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={dep} onChange={(e) => setDep(e.target.value)}>
          <option value="">Tous</option>
          {departements.map((d) => <option key={d.id} value={d.nom}>{d.nom}</option>)}
        </select>
        <button onClick={openNew} className="btn-primary"><UserPlus size={18} /> Nouvel employé</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={Users} title="Aucun employé" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="table-th">Matricule</th><th className="table-th">Employé</th><th className="table-th">Poste / Département</th><th className="table-th">Contact</th><th className="table-th">Embauché le</th><th className="table-th text-right">Salaire</th><th className="table-th"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="table-td text-xs text-slate-400">{e.matricule}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">{(e.nom[0] || '') + (e.prenom?.[0] || '')}</span>
                        <span className="font-semibold text-slate-900">{e.nom} {e.prenom}</span>
                      </div>
                    </td>
                    <td className="table-td"><div className="font-medium text-slate-700">{e.poste || '—'}</div><div className="text-xs text-slate-400">{e.departement || ''}</div></td>
                    <td className="table-td text-xs text-slate-500">{e.telephone || e.email || '—'}</td>
                    <td className="table-td text-slate-500">{formatDate(e.date_embauche)}</td>
                    <td className="table-td text-right font-semibold">{formatMoney(e.salaire, devise)}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(e)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700"><Save size={15} /></button>
                        {canDelete && <button onClick={() => remove(e)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'employé' : 'Nouvel employé'} icon={UserPlus}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nom <span className="text-red-500">*</span></label><input className="input" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Dupont" /></div>
            <div><label className="label">Prénom</label><input className="input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Jean" /></div>
            <div><label className="label">Poste</label><input className="input" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} placeholder="Comptable" /></div>
            <div><label className="label">Département</label>
              <input className="input" list="deps" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} placeholder="Finance" />
              <datalist id="deps">{departements.map((d) => <option key={d.id} value={d.nom} />)}</datalist>
            </div>
            <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="77 000 00 00" /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@example.com" /></div>
            <div><label className="label">Date d'embauche</label><input type="date" className="input" value={form.date_embauche} onChange={(e) => setForm({ ...form, date_embauche: e.target.value })} /></div>
            <div><label className="label">Salaire de base ({devise})</label><input type="number" className="input" value={form.salaire} onChange={(e) => setForm({ ...form, salaire: e.target.value })} placeholder="250 000" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : 'Créer l\'employé'}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}

/* ── Congés & Absences ──────────────────────────────────────────────────── */
const CONGE_TABS = [['tous', 'Tous'], ['en_attente', 'En attente'], ['approuve', 'Approuvés'], ['refuse', 'Refusés']]
function Conges() {
  const { canDelete } = useAuth()
  const toast = useToast()
  const [conges, setConges] = useState([])
  const [employes, setEmployes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tous')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ employe_id: '', type: 'conge_paye', date_debut: '', date_fin: '', motif: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [c, e] = await Promise.all([api.get('/conges'), api.get('/employes')])
      setConges(c.data); setEmployes(e.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = tab === 'tous' ? conges : conges.filter((c) => c.statut === tab)
  const stats = {
    total: conges.length,
    attente: conges.filter((c) => c.statut === 'en_attente').length,
    approuve: conges.filter((c) => c.statut === 'approuve').length,
    jours: conges.filter((c) => c.statut === 'approuve').reduce((s, c) => s + (c.nb_jours || 0), 0),
  }

  const submit = async (e) => {
    e.preventDefault()
    try { await api.post('/conges', form); toast.success('Demande créée'); setModal(false); setForm({ employe_id: '', type: 'conge_paye', date_debut: '', date_fin: '', motif: '' }); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const setStatut = async (c, statut) => {
    try { await api.put(`/conges/${c.id}/statut`, { statut }); toast.success('Mis à jour'); load() } catch { toast.error('Erreur') }
  }
  const remove = async (c) => {
    if (!confirm('Supprimer cette demande de congé ?')) return
    try { await api.delete(`/conges/${c.id}`); toast.success('Supprimé'); load() } catch { toast.error('Erreur') }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total demandes" value={stats.total} icon={Calendar} color="slate" />
        <StatCard label="En attente" value={stats.attente} icon={Clock} color="orange" />
        <StatCard label="Approuvés" value={stats.approuve} icon={CheckCircle2} color="green" />
        <StatCard label="Jours approuvés" value={stats.jours} icon={Calendar} color="brand" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CONGE_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${tab === k ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{l}</button>
        ))}
        <button onClick={() => setModal(true)} className="btn-primary ml-auto"><Calendar size={17} /> Nouvelle demande</button>
      </div>
      <div className="card overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={Calendar} title="Aucune demande de congé" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="table-th">Employé</th><th className="table-th">Type</th><th className="table-th">Du</th><th className="table-th">Au</th><th className="table-th text-right">Durée</th><th className="table-th">Motif</th><th className="table-th">Statut</th><th className="table-th"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="table-td font-medium text-slate-800">{c.employe_nom} {c.employe_prenom}</td>
                    <td className="table-td capitalize text-slate-500">{c.type.replace('_', ' ')}</td>
                    <td className="table-td text-slate-500">{formatDate(c.date_debut)}</td>
                    <td className="table-td text-slate-500">{formatDate(c.date_fin)}</td>
                    <td className="table-td text-right">{c.nb_jours} j</td>
                    <td className="table-td text-slate-500">{c.motif || '—'}</td>
                    <td className="table-td"><Badge status={c.statut} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        {c.statut === 'en_attente' && (
                          <>
                            <button onClick={() => setStatut(c, 'approuve')} className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Check size={16} /></button>
                            <button onClick={() => setStatut(c, 'refuse')} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
                          </>
                        )}
                        {canDelete && <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle demande de congé" icon={Calendar}>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Employé <span className="text-red-500">*</span></label>
            <select className="input" required value={form.employe_id} onChange={(e) => setForm({ ...form, employe_id: e.target.value })}>
              <option value="">Sélectionner...</option>
              {employes.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
            </select></div>
          <div><label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="conge_paye">Congé payé</option><option value="maladie">Maladie</option>
              <option value="sans_solde">Sans solde</option><option value="autre">Autre</option>
            </select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Du <span className="text-red-500">*</span></label><input type="date" className="input" required value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} /></div>
            <div><label className="label">Au <span className="text-red-500">*</span></label><input type="date" className="input" required value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} /></div>
          </div>
          <div><label className="label">Motif</label><textarea className="input" rows={2} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" className="btn-primary flex-1"><Save size={17} /> Créer la demande</button></div>
        </form>
      </Modal>
    </>
  )
}

/* ── Paie ───────────────────────────────────────────────────────────────── */
function Paie() {
  const { devise } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [mois, setMois] = useState(new Date().toISOString().slice(0, 7))
  const [bulletins, setBulletins] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/paie', { params: { mois } }); setBulletins(data) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [mois])

  const shiftMonth = (delta) => {
    const [y, m] = mois.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const generer = async () => {
    try { const { data } = await api.post('/paie/generer', { mois }); toast.success(`${data.crees} bulletin(s) généré(s)`); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const payer = async (b) => {
    try { await api.put(`/paie/${b.id}/payer`); toast.success('Bulletin payé'); load() } catch { toast.error('Erreur') }
  }
  const remove = async (b) => {
    if (!confirm(`Supprimer le bulletin de ${b.employe_nom} ${b.employe_prenom} ?`)) return
    try { await api.delete(`/paie/${b.id}`); toast.success('Bulletin supprimé'); load() } catch { toast.error('Erreur') }
  }

  const stats = {
    bulletins: bulletins.length,
    payes: bulletins.filter((b) => b.statut === 'paye').length,
    attente: bulletins.filter((b) => b.statut !== 'paye').length,
    masse: bulletins.reduce((s, b) => s + (b.net || 0), 0),
  }
  const moisLabel = new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"><ChevronLeft size={18} /></button>
          <span className="min-w-[150px] text-center font-bold capitalize text-slate-900">{moisLabel}</span>
          <button onClick={() => shiftMonth(1)} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"><ChevronRight size={18} /></button>
        </div>
        <button onClick={generer} className="btn-primary bg-violet-600 hover:bg-violet-700"><Wallet size={17} /> Générer la paie</button>
        <button onClick={load} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"><RefreshCw size={17} /></button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bulletins" value={stats.bulletins} icon={Users} color="slate" />
        <StatCard label="Payés" value={`${stats.payes} / ${stats.bulletins}`} icon={CheckCircle2} color="green" />
        <StatCard label="En attente" value={stats.attente} icon={Clock} color="orange" />
        <StatCard label="Masse nette" value={formatMoney(stats.masse, devise)} icon={Wallet} color="brand" />
      </div>

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : bulletins.length === 0 ? (
          <EmptyState icon={Wallet} title={`Aucun bulletin pour ${moisLabel}`}
            action={<button onClick={generer} className="text-sm font-semibold text-brand-700">Générer la paie</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="table-th">Employé</th><th className="table-th text-right">Salaire base</th><th className="table-th text-right">Brut</th><th className="table-th text-right">Retenues</th><th className="table-th text-right">Net</th><th className="table-th">Statut</th><th className="table-th"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {bulletins.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="table-td"><div className="font-semibold text-slate-900">{b.employe_nom} {b.employe_prenom}</div><div className="text-xs text-slate-400">{b.employe_poste}</div></td>
                    <td className="table-td text-right">{formatMoney(b.salaire_base, devise)}</td>
                    <td className="table-td text-right font-medium text-emerald-600">{formatMoney(b.salaire_base + b.primes, devise)}</td>
                    <td className="table-td text-right text-slate-500">{b.deductions ? formatMoney(b.deductions, devise) : '—'}</td>
                    <td className="table-td text-right font-bold text-slate-900">{formatMoney(b.net, devise)}</td>
                    <td className="table-td"><Badge status={b.statut} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => window.print()} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><Printer size={15} /></button>
                        {b.statut !== 'paye' && <button onClick={() => payer(b)} className="btn-primary px-3 py-1.5 text-xs"><Wallet size={14} /> Payer</button>}
                        {canDelete && <button onClick={() => remove(b)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
