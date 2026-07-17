import { useState } from 'react'
import { useLia } from '../context/LiaContext'
import {
  displayNameFromEmail,
  setCaregiverIdentity,
} from '../services/caregiverIdentity'

export function LoginScreen() {
  const { showScreen } = useLia()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finish = (displayName: string, nextEmail: string) => {
    setCaregiverIdentity({ email: nextEmail, displayName })
    showScreen('intro')
  }

  const handleSubmit = (e: React.FormEvent) => {
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
    // UI-first: senha ainda não é validada no servidor.
    const displayName = name.trim() || displayNameFromEmail(trimmedEmail)
    window.setTimeout(() => {
      finish(displayName, trimmedEmail)
      setLoading(false)
    }, 280)
  }

  const handleSkip = () => {
    showScreen('intro')
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
        <p className="login-hero-lead">
          Entre com seu e-mail para acessar o apoio da Lia no seu ritmo.
        </p>
      </div>

      <div className="login-body">
        <div className="login-body-inner">
          <header className="login-welcome">
            <p className="login-eyebrow">Entrar</p>
            <p className="login-lead">
              Use seu e-mail para continuar. Em breve este acesso será o mesmo dos colaboradores
              cadastrados no painel.
            </p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            {error ? <div className="login-alert" role="alert">{error}</div> : null}

            <label className="login-field">
              <span>Nome</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={loading}
                placeholder="Como prefere ser chamado(a)"
              />
            </label>

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

          <div className="login-footer">
            <button type="button" className="login-skip" onClick={handleSkip} disabled={loading}>
              Continuar sem conta
            </button>
          </div>
        </div>
        <img className="login-brand" src="/crescere-logo.png" alt="Crescere" />
      </div>
    </div>
  )
}
