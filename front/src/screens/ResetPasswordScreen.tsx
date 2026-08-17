import { useMemo, useState } from 'react'
import { useLia } from '../context/LiaContext'
import { resetCaregiverPassword } from '../services/caregiverAuth'

function readResetParams(): { email: string; token: string } {
  const params = new URLSearchParams(window.location.search)
  return {
    email: (params.get('email') || '').trim().toLowerCase(),
    token: (params.get('reset_token') || '').trim(),
  }
}

function clearResetParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('reset_token')
  url.searchParams.delete('email')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function ResetPasswordScreen() {
  const { showScreen } = useLia()
  const initial = useMemo(() => readResetParams(), [])
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() =>
    initial.email && initial.token ? '' : 'Link inválido ou incompleto.',
  )
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!initial.email || !initial.token) {
      setError('Link inválido ou incompleto.')
      return
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== passwordConfirmation) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const message = await resetCaregiverPassword({
        email: initial.email,
        token: initial.token,
        password,
        passwordConfirmation,
      })
      setSuccess(message)
      clearResetParams()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen slide-in login-screen" id="resetPasswordScreen">
      <div className="login-hero">
        <div className="login-hero-glow" aria-hidden />
        <div className="login-orb">
          <img src="/lia.jpeg" alt="Lia" loading="eager" />
        </div>
        <p className="login-hero-badge">Nova senha</p>
        <h1>Redefinir senha</h1>
        <p className="login-tagline">Crescere · Apoio ao Cuidador</p>
      </div>

      <div className="login-body">
        <div className="login-body-inner">
          <header className="login-welcome">
            <p className="login-eyebrow">Quase lá</p>
            <p className="login-lead">
              {initial.email
                ? `Crie uma nova senha para ${initial.email}.`
                : 'Abra o link completo enviado por e-mail.'}
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

            {!success ? (
              <>
                <label className="login-field">
                  <span>Nova senha</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={loading || !initial.token}
                    placeholder="Mínimo 6 caracteres"
                  />
                </label>
                <label className="login-field">
                  <span>Confirmar senha</span>
                  <input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={loading || !initial.token}
                    placeholder="Repita a senha"
                  />
                </label>
                <button type="submit" className="login-submit" disabled={loading || !initial.token}>
                  {loading ? 'Salvando…' : 'Salvar nova senha'}
                </button>
              </>
            ) : null}
          </form>

          <p className="login-footer">
            <button type="button" className="login-skip" onClick={() => showScreen('login')}>
              Ir para o login
            </button>
          </p>

          <img className="crescere-brand-logo login-brand" src="/crescere-logo.png" alt="Crescere" />
        </div>
      </div>
    </div>
  )
}
