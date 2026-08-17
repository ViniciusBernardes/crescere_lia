import { useState } from 'react'
import { useLia } from '../context/LiaContext'
import { forgotCaregiverPassword } from '../services/caregiverAuth'

export function ForgotPasswordScreen() {
  const { showScreen } = useLia()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Informe um e-mail válido.')
      return
    }

    setLoading(true)
    try {
      const message = await forgotCaregiverPassword(trimmedEmail)
      setSuccess(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen slide-in login-screen" id="forgotPasswordScreen">
      <div className="login-hero">
        <div className="login-hero-glow" aria-hidden />
        <div className="login-orb">
          <img src="/lia.jpeg" alt="Lia" loading="eager" />
        </div>
        <p className="login-hero-badge">Recuperar acesso</p>
        <h1>Esqueci a senha</h1>
        <p className="login-tagline">Crescere · Apoio ao Cuidador</p>
      </div>

      <div className="login-body">
        <div className="login-body-inner">
          <header className="login-welcome">
            <p className="login-eyebrow">Redefinir</p>
            <p className="login-lead">
              Informe o e-mail cadastrado. Enviaremos um link ou oriente o RH/admin a redefinir em
              Colaboradores.
            </p>
          </header>

          <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
            {error ? (
              <div className="login-alert" role="alert">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="login-alert login-alert-success" role="status">
                {success}
              </div>
            ) : null}

            <label className="login-field">
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading || Boolean(success)}
                placeholder="seu@email.com"
              />
            </label>

            <button type="submit" className="login-submit" disabled={loading || Boolean(success)}>
              {loading ? 'Enviando…' : 'Enviar instruções'}
            </button>
          </form>

          <p className="login-footer">
            <button type="button" className="login-skip" onClick={() => showScreen('login')}>
              Voltar ao login
            </button>
          </p>

          <img className="crescere-brand-logo login-brand" src="/crescere-logo.png" alt="Crescere" />
        </div>
      </div>
    </div>
  )
}
