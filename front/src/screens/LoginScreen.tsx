import { useState } from 'react'
import { useLia } from '../context/LiaContext'
import { loginCaregiver } from '../services/caregiverAuth'
import { setCaregiverIdentity } from '../services/caregiverIdentity'

export function LoginScreen() {
  const { showScreen } = useLia()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Informe um e-mail válido.')
      return
    }
    if (!password.trim()) {
      setError('Informe sua senha.')
      return
    }

    setLoading(true)
    try {
      const patient = await loginCaregiver(trimmedEmail, password)
      setCaregiverIdentity({
        email: patient.email || trimmedEmail,
        displayName: patient.name,
        patientId: patient.id,
      })
      showScreen('intro')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen slide-in login-screen" id="loginScreen">
      <div className="login-hero">
        <div className="login-hero-glow" aria-hidden />
        <div className="login-orb">
          <img src="/lia.jpeg" alt="Lia" loading="eager" />
        </div>
        <p className="login-hero-badge">Acesso do cuidador</p>
        <h1>Bem-vindo(a)</h1>
        <p className="login-tagline">Crescere · Apoio ao Cuidador</p>
      </div>

      <div className="login-body">
        <div className="login-body-inner">
          <header className="login-welcome">
            <p className="login-eyebrow">Entrar</p>
            <p className="login-lead">
              Use o e-mail e a senha cadastrados pelo administrador no painel (colaboradores).
            </p>
          </header>

          <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
            {error ? <div className="login-alert" role="alert">{error}</div> : null}

            <label className="login-field">
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
                placeholder="seu@email.com"
              />
            </label>

            <label className="login-field">
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

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
              {!loading ? (
                <span className="btn-arrow" aria-hidden>
                  →
                </span>
              ) : null}
            </button>
          </form>

          <img className="crescere-brand-logo login-brand" src="/crescere-logo.png" alt="Crescere" />
        </div>
      </div>
    </div>
  )
}
