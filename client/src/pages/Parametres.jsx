import { useState, useEffect } from 'react'
import {
  Building2, SlidersHorizontal, FileText, Tag, Briefcase, ShieldCheck,
  KeyRound, Database, Info, Save, Plus, Pencil, Trash2, RefreshCw, UserPlus,
  Copy, Check, Sparkles,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { Modal, Spinner, Badge, useToast } from '../components/ui'

const SECTIONS = [
  { key: 'entreprise', label: 'Entreprise', icon: Building2 },
  { key: 'preferences', label: 'Préférences', icon: SlidersHorizontal },
  { key: 'facture', label: 'Modèle facture', icon: FileText },
  { key: 'categories', label: 'Catégories', icon: Tag },
  { key: 'departements', label: 'Départements', icon: Briefcase },
  { key: 'securite', label: 'Sécurité', icon: ShieldCheck, admin: true },
  { key: 'licence', label: 'Licence', icon: KeyRound, superAdmin: true },
  { key: 'database', label: 'Base de données', icon: Database },
  { key: 'apropos', label: 'À propos', icon: Info },
]

export default function Parametres() {
  const { isAdmin, user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const [section, setSection] = useState('entreprise')
  const visible = SECTIONS.filter((s) => (!s.admin || isAdmin) && (!s.superAdmin || isSuperAdmin))

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="card h-fit p-3">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Paramètres</p>
        <nav className="space-y-1">
          {visible.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition
                ${section === s.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <s.icon size={17} /> {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <div>
        {section === 'entreprise' && <Entreprise />}
        {section === 'preferences' && <Preferences />}
        {section === 'facture' && <ModeleFacture />}
        {section === 'categories' && <Categories />}
        {section === 'departements' && <Departements />}
        {section === 'securite' && <Securite />}
        {section === 'licence' && <Licence />}
        {section === 'database' && <BaseDonnees />}
        {section === 'apropos' && <APropos />}
      </div>
    </div>
  )
}

function SectionHeader({ title, desc }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {desc && <p className="text-sm text-slate-400">{desc}</p>}
    </div>
  )
}

/* ── Entreprise ─────────────────────────────────────────────────────────── */
function Entreprise() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setForm(settings) }, [settings])

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }))
    reader.readAsDataURL(file)
  }
  const onSignature = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, signature: reader.result }))
    reader.readAsDataURL(file)
  }
  const submit = async () => {
    setSaving(true)
    try {
      await save({
        raison_sociale: form.raison_sociale || '', slogan: form.slogan || '', editeur: form.editeur || '',
        rccm: form.rccm || '', telephone: form.telephone || '', email: form.email || '',
        site_web: form.site_web || '', adresse: form.adresse || '', logo: form.logo || '',
        signature: form.signature || '',
      })
      toast.success('Profil enregistré')
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Profil de l'entreprise" desc="Ces informations apparaissent dans vos rapports et documents." />
      <div className="card p-5">
        <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Logo</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {form.logo ? <img src={form.logo} alt="logo" className="h-full w-full object-cover" /> : <Building2 className="text-slate-300" size={32} />}
          </div>
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-brand-300">
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            <span className="font-semibold text-brand-700">Cliquez</span> <span className="text-slate-500">ou glissez une image ici</span>
            <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG, WebP — max 5 Mo</p>
          </label>
        </div>
        {form.logo && <button onClick={() => setForm({ ...form, logo: '' })} className="mt-3 flex items-center gap-1 text-sm text-red-600"><Trash2 size={14} /> Supprimer le logo</button>}
      </div>

      <div className="card p-5">
        <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Signature & cachet</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {form.signature ? <img src={form.signature} alt="signature" className="h-full w-full object-contain" /> : <FileText className="text-slate-300" size={32} />}
          </div>
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-brand-300">
            <input type="file" accept="image/*" className="hidden" onChange={onSignature} />
            <span className="font-semibold text-brand-700">Cliquez</span> <span className="text-slate-500">ou glissez une image ici</span>
            <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG, WebP — max 5 Mo</p>
          </label>
        </div>
        {form.signature && <button onClick={() => setForm({ ...form, signature: '' })} className="mt-3 flex items-center gap-1 text-sm text-red-600"><Trash2 size={14} /> Supprimer la signature</button>}
      </div>

      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Identité</p>
        <div><label className="label">Raison sociale</label><input className="input" value={form.raison_sociale || ''} onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })} placeholder="Nom de votre entreprise" /></div>
        <div><label className="label">Slogan / Activité</label><input className="input" value={form.slogan || ''} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Votre partenaire de confiance" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Éditeur / Développeur</label><input className="input" value={form.editeur || ''} onChange={(e) => setForm({ ...form, editeur: e.target.value })} placeholder="Affiché « par ... »" /></div>
          <div><label className="label">N° RCCM / RC</label><input className="input" value={form.rccm || ''} onChange={(e) => setForm({ ...form, rccm: e.target.value })} placeholder="CI-ABJ-2024-A-12345" /></div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Coordonnées</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Téléphone</label><input className="input" value={form.telephone || ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+000 00 00 00 00" /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@exemple.com" /></div>
        </div>
        <div><label className="label">Site web</label><input className="input" value={form.site_web || ''} onChange={(e) => setForm({ ...form, site_web: e.target.value })} placeholder="https://www.exemple.com" /></div>
        <div><label className="label">Adresse</label><textarea className="input" rows={2} value={form.adresse || ''} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
      </div>

      <button onClick={submit} disabled={saving} className="btn-primary"><Save size={17} /> Enregistrer</button>
    </div>
  )
}

/* ── Préférences ────────────────────────────────────────────────────────── */
function Preferences() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])

  const submit = async () => {
    try {
      await save({
        tva_defaut: form.tva_defaut, stock_min_defaut: form.stock_min_defaut,
        delai_livraison: form.delai_livraison, devise: form.devise || 'FCFA',
      })
      toast.success('Préférences enregistrées')
    } catch { toast.error('Erreur') }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Préférences" desc="Valeurs appliquées par défaut lors de la création de nouveaux enregistrements." />
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Produits & tarification</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">TVA par défaut (%)</label><input type="number" className="input" value={form.tva_defaut || ''} onChange={(e) => setForm({ ...form, tva_defaut: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Appliquée lors de la création d'un nouveau produit.</p></div>
          <div><label className="label">Stock minimum par défaut</label><input type="number" className="input" value={form.stock_min_defaut || ''} onChange={(e) => setForm({ ...form, stock_min_defaut: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Seuil d'alerte appliqué aux nouveaux produits.</p></div>
        </div>
      </div>
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Commandes</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Délai de livraison (jours)</label><input type="number" className="input" value={form.delai_livraison || ''} onChange={(e) => setForm({ ...form, delai_livraison: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Délai indicatif affiché aux clients.</p></div>
          <div><label className="label">Devise</label><input className="input" value={form.devise || 'FCFA'} onChange={(e) => setForm({ ...form, devise: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Symbole monétaire utilisé dans toute l'application.</p></div>
        </div>
      </div>
      <button onClick={submit} className="btn-primary"><Save size={17} /> Enregistrer</button>
    </div>
  )
}

/* ── Modèle facture ─────────────────────────────────────────────────────── */
function ModeleFacture() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])
  const submit = async () => {
    try {
      await save({
        couleur_principale: form.couleur_principale || '#d6d6d1', couleur_sombre: form.couleur_sombre || '#2992f5',
        siret: form.siret || '', message_remerciement: form.message_remerciement || '',
        coordonnees_bancaires: form.coordonnees_bancaires || '', mentions_legales: form.mentions_legales || '',
      })
      toast.success('Modèle enregistré')
    } catch { toast.error('Erreur') }
  }
  return (
    <div className="space-y-5">
      <SectionHeader title="Modèle de facture" desc="Ces informations apparaissent dans l'en-tête et le pied de page de vos factures imprimées." />
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">En-tête</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Couleur principale</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-14 rounded border border-slate-200" value={form.couleur_principale || '#d6d6d1'} onChange={(e) => setForm({ ...form, couleur_principale: e.target.value })} /><input className="input" value={form.couleur_principale || '#d6d6d1'} onChange={(e) => setForm({ ...form, couleur_principale: e.target.value })} /></div></div>
          <div><label className="label">Couleur sombre (barres & badges)</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-14 rounded border border-slate-200" value={form.couleur_sombre || '#2992f5'} onChange={(e) => setForm({ ...form, couleur_sombre: e.target.value })} /><input className="input" value={form.couleur_sombre || '#2992f5'} onChange={(e) => setForm({ ...form, couleur_sombre: e.target.value })} /></div></div>
        </div>
        <div><label className="label">SIRET / N° RCCM / Identifiant fiscal</label><input className="input" value={form.siret || ''} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="SIRET : 123 456 789 00010" /></div>
      </div>
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Pied de page</p>
        <div><label className="label">Message de remerciement</label><input className="input" value={form.message_remerciement || ''} onChange={(e) => setForm({ ...form, message_remerciement: e.target.value })} placeholder="Merci pour votre confiance." /></div>
        <div><label className="label">Coordonnées bancaires (RIB / IBAN)</label><textarea className="input" rows={2} value={form.coordonnees_bancaires || ''} onChange={(e) => setForm({ ...form, coordonnees_bancaires: e.target.value })} placeholder="Banque : ... · RIB : ... · IBAN : ..." /></div>
        <div><label className="label">Mentions légales (conditions de paiement, pénalités...)</label><textarea className="input" rows={2} value={form.mentions_legales || ''} onChange={(e) => setForm({ ...form, mentions_legales: e.target.value })} placeholder="Paiement à 30 jours..." /></div>
      </div>
      <button onClick={submit} className="btn-primary"><Save size={17} /> Enregistrer</button>
    </div>
  )
}

/* ── Catégories ─────────────────────────────────────────────────────────── */
function Categories() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [nom, setNom] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/parametres/categories'); setItems(data) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const add = async (e) => { e.preventDefault(); if (!nom.trim()) return; try { await api.post('/parametres/categories', { nom }); setNom(''); load() } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } }
  const edit = async (c) => { const n = prompt('Nom de la catégorie', c.nom); if (!n) return; try { await api.put(`/parametres/categories/${c.id}`, { nom: n }); load() } catch { toast.error('Erreur') } }
  const remove = async (c) => { if (!confirm(`Supprimer "${c.nom}" ?`)) return; try { await api.delete(`/parametres/categories/${c.id}`); load() } catch { toast.error('Erreur') } }
  return (
    <div className="space-y-5">
      <SectionHeader title="Catégories de produits" desc="Gérez les catégories utilisées pour classer vos produits." />
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1"><label className="label">Ajouter une catégorie</label><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la catégorie..." /></div>
        <button type="submit" className="btn-primary"><Plus size={17} /> Ajouter</button>
      </form>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3"><p className="text-xs font-semibold uppercase text-slate-500">{items.length} catégorie(s)</p><button onClick={load} className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><RefreshCw size={14} /> Actualiser</button></div>
        {loading ? <Spinner /> : (
          <div className="divide-y divide-slate-100">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-600"><Tag size={16} /></span>
                <span className="flex-1 font-semibold text-slate-800">{c.nom}</span>
                <span className="text-sm text-slate-400">{c.nb_produits} produit(s)</span>
                <button onClick={() => edit(c)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700"><Pencil size={16} /></button>
                <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Départements ───────────────────────────────────────────────────────── */
function Departements() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [nom, setNom] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/departements'); setItems(data) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const add = async (e) => { e.preventDefault(); if (!nom.trim()) return; try { await api.post('/departements', { nom }); setNom(''); load() } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } }
  const edit = async (d) => { const n = prompt('Nom du département', d.nom); if (!n) return; try { await api.put(`/departements/${d.id}`, { nom: n }); load() } catch { toast.error('Erreur') } }
  const remove = async (d) => { if (!confirm(`Supprimer "${d.nom}" ?`)) return; try { await api.delete(`/departements/${d.id}`); load() } catch { toast.error('Erreur') } }
  return (
    <div className="space-y-5">
      <SectionHeader title="Départements" desc="Gérez les départements proposés lors de la création d'un employé." />
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1"><label className="label">Ajouter un département</label><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du département..." /></div>
        <button type="submit" className="btn-primary"><Plus size={17} /> Ajouter</button>
      </form>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3"><p className="text-xs font-semibold uppercase text-slate-500">{items.length} département(s)</p><button onClick={load} className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><RefreshCw size={14} /> Actualiser</button></div>
        {loading ? <Spinner /> : (
          <div className="divide-y divide-slate-100">
            {items.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-600"><Briefcase size={16} /></span>
                <span className="flex-1 font-semibold text-slate-800">{d.nom}</span>
                <button onClick={() => edit(d)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700"><Pencil size={16} /></button>
                <button onClick={() => remove(d)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Sécurité ───────────────────────────────────────────────────────────── */
const MODULES = ['dashboard', 'clients', 'produits', 'commandes', 'ventes', 'caisse', 'facturation', 'personnel', 'rapports', 'journal', 'parametres']
const POSTES = [
  { value: '', label: 'Aucun (par défaut)' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'caissier', label: 'Caissier' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'magasinier', label: 'Magasinier' },
  { value: 'rh', label: 'Ressources Humaines' },
  { value: 'autre', label: 'Autre' },
]
function Securite() {
  const toast = useToast()
  const [pwd, setPwd] = useState({ ancien: '', nouveau: '', confirm: '', show: false })
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ username: '', email: '', nom: '', password: '', role: 'user', poste: '', permissions: [] })

  const loadUsers = async () => { try { const { data } = await api.get('/parametres/users'); setUsers(data) } catch { /* */ } }
  useEffect(() => { loadUsers() }, [])

  const changePwd = async (e) => {
    e.preventDefault()
    if (pwd.nouveau !== pwd.confirm) return toast.error('Les mots de passe ne correspondent pas')
    try { await api.post('/parametres/password', { ancien: pwd.ancien, nouveau: pwd.nouveau }); toast.success('Mot de passe modifié'); setPwd({ ancien: '', nouveau: '', confirm: '', show: false }) }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const openNew = () => { setForm({ username: '', email: '', nom: '', password: '', role: 'user', poste: '', permissions: [] }); setEditing(null); setModal(true) }
  const openEdit = (u) => {
    let perms = []
    try { perms = JSON.parse(u.permissions) || [] } catch { perms = [] }
    setForm({ username: u.username, email: u.email || '', nom: u.nom, password: '', role: u.role, poste: u.poste || '', permissions: Array.isArray(perms) ? perms : [] })
    setEditing(u); setModal(true)
  }
  const toggle = (m) => setForm((f) => ({ ...f, permissions: f.permissions.includes(m) ? f.permissions.filter((x) => x !== m) : [...f.permissions, m] }))
  const submit = async (e) => {
    e.preventDefault()
    const payload = { ...form, permissions: form.role === 'user' ? form.permissions : null }
    try {
      if (editing) { await api.put(`/parametres/users/${editing.id}`, payload); toast.success('Utilisateur modifié') }
      else { await api.post('/parametres/users', payload); toast.success('Utilisateur créé') }
      setModal(false); loadUsers()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const remove = async (u) => { if (!confirm(`Supprimer ${u.nom} ?`)) return; try { await api.delete(`/parametres/users/${u.id}`); loadUsers() } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } }

  const roleLabel = { super_admin: 'Super Admin', admin: 'Admin', user: 'Utilisateur' }
  const roleColor = { super_admin: 'bg-violet-100 text-violet-700', admin: 'bg-brand-100 text-brand-700', user: 'bg-slate-100 text-slate-600' }
  const posteLabel = { comptable: 'Comptable', caissier: 'Caissier', commercial: 'Commercial', magasinier: 'Magasinier', rh: 'RH', autre: 'Autre' }

  return (
    <div className="space-y-5">
      <SectionHeader title="Sécurité" desc="Gestion du mot de passe et des comptes utilisateurs." />
      <form onSubmit={changePwd} className="card space-y-3 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Changer mon mot de passe</p>
        <input type={pwd.show ? 'text' : 'password'} className="input" placeholder="Mot de passe actuel" value={pwd.ancien} onChange={(e) => setPwd({ ...pwd, ancien: e.target.value })} required />
        <input type={pwd.show ? 'text' : 'password'} className="input" placeholder="Nouveau mot de passe" value={pwd.nouveau} onChange={(e) => setPwd({ ...pwd, nouveau: e.target.value })} required />
        <input type={pwd.show ? 'text' : 'password'} className="input" placeholder="Confirmer le nouveau" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pwd.show} onChange={(e) => setPwd({ ...pwd, show: e.target.checked })} /> Afficher les mots de passe</label>
        <button type="submit" className="btn-primary w-fit"><Save size={16} /> Modifier le mot de passe</button>
      </form>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4"><p className="text-xs font-semibold uppercase text-slate-500">Utilisateurs</p><button onClick={openNew} className="btn-secondary py-2"><UserPlus size={15} /> Ajouter</button></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">Utilisateur</th>
                <th className="table-th">Email</th>
                <th className="table-th">Rôle</th>
                <th className="table-th">Poste</th>
                <th className="table-th">Modules</th>
                <th className="table-th">Statut</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                let perms = null; try { perms = JSON.parse(u.permissions) } catch { perms = null }
                const isSA = u.role === 'super_admin'
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="table-td"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{u.nom[0].toUpperCase()}</span><span className="font-semibold text-slate-900">{u.nom}</span></div></td>
                    <td className="table-td font-mono text-xs text-slate-500">{u.email}</td>
                    <td className="table-td"><span className={`badge ${roleColor[u.role]}`}>{roleLabel[u.role]}</span></td>
                    <td className="table-td text-sm text-slate-600">{u.poste ? (posteLabel[u.poste] || u.poste) : '—'}</td>
                    <td className="table-td text-sm text-slate-500">{u.role === 'user' ? <span className="flex flex-col gap-0.5"><span>{perms?.length ? `${perms.length} modules` : 'Aucun'}</span>{perms?.includes('can_delete') && <span className="badge bg-red-100 text-red-700 w-fit">Suppression</span>}</span> : <span className="font-semibold text-emerald-600">Accès complet</span>}</td>
                    <td className="table-td"><Badge status={u.actif ? 'actif' : 'inactif'} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        {!isSA && <button onClick={() => openEdit(u)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700"><Pencil size={16} /></button>}
                        {!isSA && <button onClick={() => remove(u)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} icon={UserPlus}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nom complet</label><input className="input" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" className="input" required disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="label">Mot de passe {editing && <span className="text-xs font-normal text-slate-400">(laisser vide pour ne pas changer)</span>}</label><input type="password" className="input" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">Utilisateur</option><option value="admin">Admin</option>
            </select>
          </div>
          <div><label className="label">Poste / Fonction</label>
            <select className="input" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })}>
              {POSTES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Le poste détermine certains privilèges (ex: seul le comptable et les admins peuvent approvisionner la petite caisse)</p>
          </div>
          {form.role === 'user' && (
            <>
              <div>
                <label className="label">Modules autorisés</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MODULES.map((m) => (
                    <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${form.permissions.includes(m) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                      <input type="checkbox" checked={form.permissions.includes(m)} onChange={() => toggle(m)} /> {m}
                    </label>
                  ))}
                </div>
              </div>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.permissions.includes('can_delete') ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}>
                <input type="checkbox" checked={form.permissions.includes('can_delete')} onChange={() => toggle('can_delete')} /> Droit de suppression (toutes les données)
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.permissions.includes('can_print') ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                <input type="checkbox" checked={form.permissions.includes('can_print')} onChange={() => toggle('can_print')} /> Droit d'impression (factures, reçus, états de caisse)
              </label>
            </>
          )}
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : 'Créer'}</button></div>
        </form>
      </Modal>
    </div>
  )
}

/* ── Licence ────────────────────────────────────────────────────────────── */
function Licence() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const toast = useToast()
  const [info, setInfo] = useState(null)
  useEffect(() => { api.get('/licence/info').then(({ data }) => setInfo(data)).catch(() => setInfo(null)) }, [])

  // Licence generation form
  const [form, setForm] = useState({ entreprise: '', expiration: '', max_users: '', modules: 'all' })
  const [generated, setGenerated] = useState(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const doGenerate = async (e) => {
    e.preventDefault()
    if (!form.entreprise || !form.expiration) return
    setGenerating(true)
    try {
      const payload = { entreprise: form.entreprise, expiration: form.expiration }
      if (form.max_users) payload.max_users = parseInt(form.max_users, 10)
      if (form.modules) payload.modules = form.modules.split(',').map((m) => m.trim())
      const { data } = await api.post('/licence/generate', payload)
      setGenerated(data.key)
      setCopied(false)
      toast.success('Licence générée avec succès')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!info) return <Spinner />
  const rows = [
    ['Entreprise', info.entreprise || '—'],
    ['Expiration', info.expiration ? formatDate(info.expiration) : '—'],
    ['Jours restants', info.jours_restants != null ? `${info.jours_restants} jour(s)` : '—'],
    ['Utilisateurs max', info.max_users ?? 'Illimité'],
    ['Modules', Array.isArray(info.modules) ? info.modules.join(', ') : (info.modules || 'all')],
    ['Émise le', info.issued_at ? formatDate(info.issued_at) : '—'],
  ]
  return (
    <div className="space-y-5">
      <SectionHeader title="Licence" desc="Informations sur la licence logicielle." />
      <div className="card overflow-hidden">
        <div className={`flex items-center justify-between px-5 py-4 ${info.valid ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <span className="flex items-center gap-2 font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${info.valid ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {info.valid ? 'Licence active' : (info.expired ? 'Licence expirée' : 'Licence invalide')}
          </span>
          {info.jours_restants != null && info.jours_restants <= 30 && info.valid && (
            <span className="text-sm font-medium text-amber-600">Expire dans {info.jours_restants} jour(s)</span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between px-5 py-3.5"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-900">{v}</span></div>
          ))}
        </div>
      </div>
      {info.reason && <p className="text-sm text-slate-400">{info.reason}</p>}

      {/* Générateur de licence — super_admin uniquement */}
      {isSuperAdmin && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-bold text-slate-900">
            <Sparkles size={18} /> Générer une licence
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-500">
              Générez une clé de licence pour une autre entreprise. La clé utilisera le secret défini dans <code className="rounded bg-slate-100 px-1 text-xs">LICENCE_SECRET</code> du fichier <code className="rounded bg-slate-100 px-1 text-xs">.env</code>.
            </p>
            <form onSubmit={doGenerate} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Nom de l'entreprise *</label>
                <input className="input" placeholder="Ex: Société ABC SARL" value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} required />
              </div>
              <div>
                <label className="label">Date d'expiration *</label>
                <input type="date" className="input" value={form.expiration} onChange={(e) => setForm({ ...form, expiration: e.target.value })} required />
              </div>
              <div>
                <label className="label">Utilisateurs max (vide = illimité)</label>
                <input type="number" className="input" placeholder="Ex: 10" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Modules (séparés par virgule)</label>
                <input className="input" placeholder="all" value={form.modules} onChange={(e) => setForm({ ...form, modules: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={generating} className="btn-primary">
                  <KeyRound size={16} /> {generating ? 'Génération...' : 'Générer la licence'}
                </button>
              </div>
            </form>

            {generated && (
              <div className="rounded-lg border-2 border-brand-200 bg-brand-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-700">Clé de licence générée</span>
                  <button onClick={copyKey} className="btn-secondary py-1.5 text-xs">
                    {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
                  </button>
                </div>
                <textarea readOnly className="w-full rounded-lg border border-brand-200 bg-white p-3 font-mono text-xs text-slate-700" rows={4} value={generated} onClick={(e) => e.target.select()} />
                <p className="text-xs text-slate-500">
                  Copiez cette clé et ajoutez-la dans le fichier <code className="rounded bg-white px-1">.env</code> de l'installation client :
                  <code className="mt-1 block rounded bg-white px-2 py-1 text-xs">LICENCE_KEY={generated.slice(0, 40)}...</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Base de données ────────────────────────────────────────────────────── */
function BaseDonnees() {
  const { devise } = useSettings()
  const [data, setData] = useState(null)
  const load = () => api.get('/parametres/database').then(({ data }) => setData(data)).catch(() => setData(null))
  useEffect(() => { load() }, [])
  if (!data) return <Spinner />
  const cards = [
    { label: 'Clients', value: `${data.clients.actifs} / ${data.clients.total}`, sub: 'actifs / total', color: 'bg-brand-100 text-brand-600' },
    { label: 'Produits', value: `${data.produits.actifs} / ${data.produits.total}`, sub: 'actifs / total', color: 'bg-violet-100 text-violet-600' },
    { label: 'Catégories', value: data.categories, sub: 'familles produit', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Commandes', value: data.commandes.total, sub: `${data.commandes.livrees} livrée(s)`, color: 'bg-amber-100 text-amber-600' },
    { label: 'CA total livré', value: formatMoney(data.ca_livre, devise), sub: 'toutes périodes', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Lignes de cmd', value: data.lignes_commande, sub: 'articles commandés', color: 'bg-slate-100 text-slate-500' },
  ]
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Base de données" desc="Statistiques et informations sur les données stockées." />
        <button onClick={load} className="btn-secondary py-2"><RefreshCw size={15} /> Actualiser</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <span className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${c.color}`}><Database size={18} /></span>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-sm font-medium text-slate-600">{c.label}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Informations</p>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Première commande</span><span className="font-medium">{data.premiere_commande ? formatDate(data.premiere_commande) : '—'}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Dernière commande</span><span className="font-medium">{data.derniere_commande ? formatDate(data.derniere_commande) : '—'}</span></div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>Sauvegarde recommandée</b> — Effectuez des sauvegardes régulières de votre base de données pour protéger vos données.
      </div>
    </div>
  )
}

/* ── À propos ───────────────────────────────────────────────────────────── */
function APropos() {
  const { appName, settings } = useSettings()
  return (
    <div className="space-y-5">
      <SectionHeader title="À propos" desc="Informations sur l'application." />
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 bg-slate-900 px-6 py-6 text-white">
          <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-brand-600 text-2xl font-bold">
            {settings.logo ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" /> : appName[0].toUpperCase()}
          </span>
          <div><h3 className="text-2xl font-bold">{appName}</h3><p className="text-brand-300">Application de Gestion d'Entreprise</p></div>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            ['Version', '1.0.0'],
            ['Éditeur', settings.editeur || '—'],
            ['Contact', settings.email || '—'],
            ['Licence', 'Usage interne entreprise'],
            ['Année', String(new Date().getFullYear())],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-6 py-3.5"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-900">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Technologies</p>
        <p className="mt-2 text-sm text-slate-600">Frontend : React 18 · Vite · Tailwind CSS · React Router v6</p>
        <p className="text-sm text-slate-600">Backend : Node.js · Express · SQL Server</p>
      </div>
    </div>
  )
}
