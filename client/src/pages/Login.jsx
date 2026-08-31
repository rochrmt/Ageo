import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Lock, Mail, Loader2 } from 'lucide-react'
import { useAuth } from '../context/Auth'
import { useSettings } from '../context/Settings'

export default function Login() {
  const { login, user } = useAuth()
  const { appName, settings, reload } = useSettings()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (user && localStorage.getItem('token')) navigate('/') }, [user, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email.trim(), password)
      await reload()
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-brand-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg">
            {settings.logo
              ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" />
              : appName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{appName}</h1>
            <p className="text-sm text-slate-300">{settings.slogan || "Application de gestion d'entreprise"}</p>
          </div>
        </div>

        <form onSubmit={submit} className="card p-6">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Connexion</h2>
          <p className="mb-5 text-sm text-slate-500">Accédez à votre espace de gestion.</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <label className="label">Email</label>
          <div className="relative mb-4">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.com" autoFocus required />
          </div>

          <label className="label">Mot de passe</label>
          <div className="relative mb-6">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Se connecter
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Première connexion : email <b>admin@entreprise.com</b> · mot de passe <b>admin1234</b>
        </p>
      </div>
    </div>
  )
}
