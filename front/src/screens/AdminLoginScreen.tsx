import { useState } from 'react'
import { loginAdmin } from '../services/adminAuth'
import '../styles/admin.css'

export function AdminLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginAdmin(username.trim(), password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-page admin-login-page">
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <div className="admin-login-brand">
            <img src="/lia.jpeg" alt="Lia" className="admin-login-avatar" />
            <span className="admin-eyebrow">Painel Admin</span>
            <img src="/crescere-logo.png" alt="Crescere" className="admin-login-brand-logo" />
            <p>Entre com usuário e senha para configurar empresas, OpenAI e prompts.</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-form admin-login-form">
            {error && <div className="admin-alert admin-alert-error">{error}</div>}

            <label className="admin-field">
              <span>Usuário</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                disabled={loading}
                placeholder="admin"
              />
            </label>

            <label className="admin-field">
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
                placeholder="••••••••"
              />
            </label>

            <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
