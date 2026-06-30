import { useCallback, useEffect, useState } from 'react'
import {
  clearAdminToken,
  createTenant,
  fetchOpenAiCredentials,
  fetchTenants,
  getAdminToken,
  saveOpenAiCredentials,
  setAdminToken,
  verifyAdminToken,
  type OpenAiCredentialsPublic,
  type Tenant,
} from '../services/adminApi'
import '../styles/admin.css'

export function AdminScreen() {
  const [tokenInput, setTokenInput] = useState(getAdminToken())
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedSlug, setSelectedSlug] = useState('crescere')
  const [config, setConfig] = useState<OpenAiCredentialsPublic | null>(null)

  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantSlug, setNewTenantSlug] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [whisperModel, setWhisperModel] = useState('whisper-1')
  const [maxTokens, setMaxTokens] = useState(1024)
  const [temperature, setTemperature] = useState(0.7)

  const loadTenants = useCallback(async () => {
    const list = await fetchTenants()
    setTenants(list)
    if (list.length && !list.some((t) => t.slug === selectedSlug)) {
      setSelectedSlug(list[0].slug)
    }
  }, [selectedSlug])

  const loadConfig = useCallback(
    async (slug: string) => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchOpenAiCredentials(slug)
        setConfig(data)
        setModel(data.model)
        setWhisperModel(data.whisperModel)
        setMaxTokens(data.maxTokens)
        setTemperature(data.temperature)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const token = getAdminToken()
    if (!token) return
    setAdminToken(token)
    verifyAdminToken()
      .then(async () => {
        setAuthenticated(true)
        await loadTenants()
      })
      .catch(() => {
        clearAdminToken()
        setAuthenticated(false)
      })
  }, [loadTenants])

  useEffect(() => {
    if (!authenticated || !selectedSlug) return
    loadConfig(selectedSlug)
  }, [authenticated, selectedSlug, loadConfig])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      setAdminToken(tokenInput.trim())
      await verifyAdminToken()
      setAuthenticated(true)
      await loadTenants()
      setSuccess('Acesso autorizado.')
    } catch (err) {
      clearAdminToken()
      setAuthenticated(false)
      setError(err instanceof Error ? err.message : 'Token inválido')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAdminToken()
    setAuthenticated(false)
    setConfig(null)
    setTenants([])
    setApiKey('')
    setTokenInput('')
    setSuccess('')
    setError('')
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const tenant = await createTenant(newTenantName, newTenantSlug)
      await loadTenants()
      setSelectedSlug(tenant.slug)
      setNewTenantName('')
      setNewTenantSlug('')
      setSuccess(`Empresa "${tenant.name}" criada.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar empresa')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlug) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const data = await saveOpenAiCredentials(selectedSlug, {
        apiKey: apiKey.trim() || undefined,
        model,
        whisperModel,
        maxTokens,
        temperature,
      })
      setConfig(data)
      setApiKey('')
      setSuccess(`Credenciais salvas para ${data.tenantName}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Crescere LIA · Whitelabel</p>
            <h1>Painel Admin</h1>
            <p className="admin-sub">
              Cada empresa tem sua própria chave OpenAI no banco — pronto para whitelabel.
            </p>
          </div>
          <a className="admin-back" href="/">
            ← Voltar ao app
          </a>
        </header>

        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        {success && <div className="admin-alert admin-alert-success">{success}</div>}

        {!authenticated ? (
          <section className="admin-card">
            <h2>Acesso administrativo</h2>
            <p className="admin-hint">
              Informe o token definido em <code>ADMIN_TOKEN</code> no servidor.
              <br />
              Localmente, o back precisa estar rodando em <code>http://localhost:3000</code> — use{' '}
              <code>npm run dev</code> na raiz ou <code>cd back && npm run dev</code> em outro terminal.
            </p>
            <form onSubmit={handleLogin} className="admin-form">
              <label className="admin-field">
                <span>Token de admin</span>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
                {loading ? 'Verificando…' : 'Entrar'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="admin-card">
              <h2>Nova empresa (whitelabel)</h2>
              <p className="admin-hint">
                O identificador (slug) será usado no header <code>X-Tenant-Slug</code> do front de cada cliente.
              </p>
              <form onSubmit={handleCreateTenant} className="admin-form">
                <div className="admin-grid">
                  <label className="admin-field">
                    <span>Nome da empresa</span>
                    <input
                      type="text"
                      value={newTenantName}
                      onChange={(e) => setNewTenantName(e.target.value)}
                      placeholder="Ex.: Clínica Esperança"
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>Identificador (slug)</span>
                    <input
                      type="text"
                      value={newTenantSlug}
                      onChange={(e) => setNewTenantSlug(e.target.value)}
                      placeholder="ex: clinica-esperanca"
                      required
                    />
                  </label>
                </div>
                <button type="submit" className="admin-btn admin-btn-secondary" disabled={loading}>
                  Cadastrar empresa
                </button>
              </form>
            </section>

            <section className="admin-card admin-status-card">
              <div className="admin-status-row">
                <div className="admin-field" style={{ flex: 1, marginBottom: 0 }}>
                  <span>Empresa</span>
                  <select
                    className="admin-select"
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>
                <span
                  className={`admin-badge ${config?.configured ? 'admin-badge-ok' : 'admin-badge-warn'}`}
                >
                  {config?.configured ? 'OpenAI ativa' : 'Pendente'}
                </span>
              </div>
              {config?.apiKeyMasked && (
                <p className="admin-masked-key">
                  Chave: <code>{config.apiKeyMasked}</code>
                </p>
              )}
              <button type="button" className="admin-btn admin-btn-ghost" onClick={handleLogout}>
                Sair
              </button>
            </section>

            <section className="admin-card">
              <h2>Credenciais OpenAI — {config?.tenantName || selectedSlug}</h2>
              <form onSubmit={handleSave} className="admin-form">
                <label className="admin-field">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      config?.configured
                        ? 'Deixe em branco para manter a chave atual'
                        : 'sk-proj-...'
                    }
                    autoComplete="new-password"
                  />
                </label>

                <div className="admin-grid">
                  <label className="admin-field">
                    <span>Modelo (chat)</span>
                    <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required />
                  </label>
                  <label className="admin-field">
                    <span>Modelo (Whisper)</span>
                    <input
                      type="text"
                      value={whisperModel}
                      onChange={(e) => setWhisperModel(e.target.value)}
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>Max tokens</span>
                    <input
                      type="number"
                      min={256}
                      max={4096}
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>Temperature</span>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>

                <div className="admin-form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={saving || loading || (!config?.configured && !apiKey.trim())}
                  >
                    {saving ? 'Salvando…' : 'Salvar credenciais'}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
