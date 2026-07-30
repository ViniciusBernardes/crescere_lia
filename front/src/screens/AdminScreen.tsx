import { useCallback, useEffect, useState } from 'react'
import {
  createTenant,
  fetchAppConfig,
  fetchOpenAiCredentials,
  fetchPromptConfig,
  fetchTenants,
  IDLE_TIMEOUT_OPTIONS,
  importEnvOpenAiCredentials,
  saveAppConfig,
  saveOpenAiCredentials,
  savePromptConfig,
  type AppConfigPublic,
  type IdleTimeoutMs,
  type OpenAiCredentialsPublic,
  type PromptConfigPublic,
  type Tenant,
} from '../services/adminApi'
import { AdminAuthError, clearAdminToken } from '../services/adminAuth'
import '../styles/admin.css'

function handleAdminError(err: unknown, onLogout?: () => void): string {
  if (err instanceof AdminAuthError) {
    clearAdminToken()
    onLogout?.()
    return 'Sessão expirada. Faça login novamente.'
  }
  return err instanceof Error ? err.message : 'Erro'
}

function CardHead({
  icon,
  title,
  subtitle,
  description,
}: {
  icon: string
  title: string
  subtitle?: string
  description: string
}) {
  return (
    <div className="admin-card-head">
      <div className="admin-card-icon" aria-hidden>
        {icon}
      </div>
      <div className="admin-card-head-text">
        <h2>{title}</h2>
        {subtitle ? <p className="admin-card-subtitle">{subtitle}</p> : null}
        <p>{description}</p>
      </div>
    </div>
  )
}

export function AdminScreen({ onLogout }: { onLogout?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [savingAppConfig, setSavingAppConfig] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedSlug, setSelectedSlug] = useState('crescere')
  const [config, setConfig] = useState<OpenAiCredentialsPublic | null>(null)
  const [promptConfig, setPromptConfig] = useState<PromptConfigPublic | null>(null)
  const [appConfig, setAppConfig] = useState<AppConfigPublic | null>(null)

  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantSlug, setNewTenantSlug] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [whisperModel, setWhisperModel] = useState('whisper-1')
  const [maxTokens, setMaxTokens] = useState(1024)
  const [temperature, setTemperature] = useState(0.7)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [idleTimeoutMs, setIdleTimeoutMs] = useState<IdleTimeoutMs>(30000)

  const loadTenants = useCallback(async () => {
    const list = await fetchTenants()
    setTenants(list)
    if (list.length && !list.some((t) => t.slug === selectedSlug)) {
      setSelectedSlug(list[0].slug)
    }
  }, [selectedSlug])

  const loadConfig = useCallback(async (slug: string) => {
    setLoading(true)
    setError('')
    try {
      const [openAiData, promptData, appConfigData] = await Promise.all([
        fetchOpenAiCredentials(slug),
        fetchPromptConfig(slug),
        fetchAppConfig(slug),
      ])
      setConfig(openAiData)
      setPromptConfig(promptData)
      setAppConfig(appConfigData)
      setModel(openAiData.model)
      setWhisperModel(openAiData.whisperModel)
      setMaxTokens(openAiData.maxTokens)
      setTemperature(openAiData.temperature)
      setSystemPrompt(promptData.systemPrompt)
      setIdleTimeoutMs(appConfigData.idleTimeoutMs)
    } catch (err) {
      setError(handleAdminError(err, onLogout))
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => {
    loadTenants().catch((err) => {
      setError(handleAdminError(err, onLogout))
    })
  }, [loadTenants, onLogout])

  useEffect(() => {
    if (!selectedSlug) return
    loadConfig(selectedSlug)
  }, [selectedSlug, loadConfig])

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
      setError(handleAdminError(err, onLogout))
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
      setSuccess(`Credenciais OpenAI salvas para ${data.tenantName}.`)
    } catch (err) {
      setError(handleAdminError(err, onLogout))
    } finally {
      setSaving(false)
    }
  }

  const handleImportEnvKey = async () => {
    if (!selectedSlug) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const data = await importEnvOpenAiCredentials(selectedSlug)
      setConfig(data)
      setModel(data.model)
      setWhisperModel(data.whisperModel)
      setMaxTokens(data.maxTokens)
      setTemperature(data.temperature)
      setApiKey('')
      setSuccess(`Chave do servidor cadastrada no banco para ${data.tenantName}.`)
    } catch (err) {
      setError(handleAdminError(err, onLogout))
    } finally {
      setSaving(false)
    }
  }

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlug) return
    setSavingPrompt(true)
    setError('')
    setSuccess('')
    try {
      const data = await savePromptConfig(selectedSlug, systemPrompt)
      setPromptConfig(data)
      setSystemPrompt(data.systemPrompt)
      setSuccess(`Prompt de atendimento salvo para ${data.tenantName}.`)
    } catch (err) {
      setError(handleAdminError(err, onLogout))
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleResetPrompt = () => {
    if (!promptConfig) return
    setSystemPrompt(promptConfig.defaultPrompt)
  }

  const handleClearCustomPrompt = async () => {
    if (!selectedSlug || !promptConfig) return
    setSavingPrompt(true)
    setError('')
    setSuccess('')
    try {
      const data = await savePromptConfig(selectedSlug, '')
      setPromptConfig(data)
      setSystemPrompt(data.systemPrompt)
      setSuccess(`Prompt restaurado para o padrão da Lia (${data.tenantName}).`)
    } catch (err) {
      setError(handleAdminError(err, onLogout))
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleSaveAppConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlug) return
    setSavingAppConfig(true)
    setError('')
    setSuccess('')
    try {
      const data = await saveAppConfig(selectedSlug, idleTimeoutMs)
      setAppConfig(data)
      setIdleTimeoutMs(data.idleTimeoutMs)
      setSuccess(`Tempo de inatividade salvo para ${data.tenantName}.`)
    } catch (err) {
      setError(handleAdminError(err, onLogout))
    } finally {
      setSavingAppConfig(false)
    }
  }

  const promptIsDirty =
    promptConfig !== null && systemPrompt.trim() !== promptConfig.systemPrompt.trim()
  const promptUsesDefault =
    promptConfig !== null &&
    systemPrompt.trim() === promptConfig.defaultPrompt.trim()
  const appConfigIsDirty =
    appConfig !== null && idleTimeoutMs !== appConfig.idleTimeoutMs
  const idleTimeoutLabel =
    IDLE_TIMEOUT_OPTIONS.find((o) => o.value === idleTimeoutMs)?.label ?? '30 segundos'
  const tenantLabel = config?.tenantName || selectedSlug
  const openAiCanSave = Boolean(apiKey.trim()) || Boolean(config?.storedInDatabase)
  const openAiSourceLabel =
    config?.credentialsSource === 'database'
      ? 'Salva no banco desta empresa'
      : config?.credentialsSource === 'env'
        ? 'Ativa via .env do servidor (fallback)'
        : null

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <a className="admin-topbar-back" href="/" aria-label="Voltar ao app">
            ←
          </a>
          <div className="admin-topbar-brand">
            <img src="/lia.jpeg" alt="" className="admin-topbar-avatar" />
            <div className="admin-topbar-title">
              <span className="admin-eyebrow">Painel Admin</span>
              <strong>Crescere LIA</strong>
            </div>
          </div>
          {onLogout && (
            <button type="button" className="admin-btn admin-btn-ghost admin-topbar-logout" onClick={onLogout}>
              Sair
            </button>
          )}
        </div>
      </header>

      <div className="admin-hero">
        <div className="admin-hero-inner">
          <div className="admin-hero-copy">
            <h1>Configurações da Lia</h1>
            <p>
              Personalize o tom de atendimento e a integração OpenAI para cada empresa do whitelabel.
            </p>
          </div>
          <div className="admin-hero-orb" aria-hidden>
            <img src="/lia.jpeg" alt="" />
          </div>
        </div>
      </div>

      <div className="admin-shell">
        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        {success && <div className="admin-alert admin-alert-success">{success}</div>}
        {loading && (
          <div className="admin-loading" role="status">
            <span className="admin-loading-dot" aria-hidden />
            Carregando configurações…
          </div>
        )}

        <div className="admin-board">
        <section className="admin-card admin-card-featured admin-card-tenant">
          <CardHead
            icon="🏢"
            title="Empresa ativa"
            description="Selecione qual clínica ou cliente você está configurando."
          />
          <div className="admin-tenant-bar">
            <label className="admin-field">
              <span>Empresa</span>
              <select
                className="admin-select"
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                disabled={loading}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-badge-row">
              <span
                className={`admin-badge ${config?.configured ? 'admin-badge-ok' : 'admin-badge-warn'}`}
              >
                {config?.configured ? 'OpenAI ativa' : 'OpenAI pendente'}
              </span>
              <span
                className={`admin-badge ${promptConfig?.isCustom ? 'admin-badge-ok' : 'admin-badge-neutral'}`}
              >
                {promptConfig?.isCustom ? 'Prompt customizado' : 'Prompt padrão'}
              </span>
              <span className="admin-badge admin-badge-neutral">
                Inatividade: {idleTimeoutLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="admin-card">
          <CardHead
            icon="⏱️"
            title="Inatividade no chat"
            subtitle={tenantLabel}
            description="Depois deste tempo sem interação, a Lia envia um aviso e abre o pop-up para continuar ou encerrar."
          />
          <form onSubmit={handleSaveAppConfig} className="admin-form">
            <label className="admin-field">
              <span>Tempo até o aviso</span>
              <select
                className="admin-select"
                value={idleTimeoutMs}
                onChange={(e) => setIdleTimeoutMs(Number(e.target.value) as IdleTimeoutMs)}
                disabled={loading || savingAppConfig}
              >
                {IDLE_TIMEOUT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className={`admin-meta${appConfigIsDirty ? ' admin-meta-dirty' : ''}`}>
              Opções: 30 segundos, 1 minuto ou 2 minutos
              {appConfigIsDirty ? ' · alterações não salvas' : ''}
            </p>
            <div className="admin-form-actions">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={savingAppConfig || loading || !appConfigIsDirty}
              >
                {savingAppConfig ? 'Salvando…' : 'Salvar tempo'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card admin-card-featured admin-card-prompt">
          <CardHead
            icon="💬"
            title="Prompt de atendimento"
            subtitle={tenantLabel}
            description="Fallback offline apenas. Com a integração iClinica ativa, o chat usa o prompt do painel Crescere (Master/clínica). Este texto só entra se o iClinica estiver indisponível."
          />
          <form onSubmit={handleSavePrompt} className="admin-form">
            <label className="admin-field">
              <span>Instruções do sistema</span>
              <div className="admin-textarea-wrap">
                <textarea
                  className="admin-textarea"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  disabled={loading || savingPrompt}
                  placeholder="Descreva o papel, tom de voz e regras da Lia para esta empresa…"
                />
              </div>
            </label>
            <p className={`admin-meta${promptIsDirty ? ' admin-meta-dirty' : ''}`}>
              {systemPrompt.length.toLocaleString('pt-BR')} caracteres
              {promptIsDirty ? ' · alterações não salvas' : ''}
            </p>
            <div className="admin-form-actions admin-form-actions--sticky">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={savingPrompt || loading || !promptIsDirty}
              >
                {savingPrompt ? 'Salvando…' : 'Salvar prompt'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={handleResetPrompt}
                disabled={savingPrompt || loading || !promptConfig || promptUsesDefault}
              >
                Preencher padrão
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={handleClearCustomPrompt}
                disabled={savingPrompt || loading || !promptConfig?.isCustom}
              >
                Usar prompt padrão
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card admin-card-openai">
          <CardHead
            icon="🔑"
            title="OpenAI"
            subtitle={tenantLabel}
            description="Chave e modelos usados no chat, voz e transcrição desta empresa."
          />
          <form onSubmit={handleSave} className="admin-form">
            {config?.apiKeyMasked && (
              <div className="admin-key-status">
                <p className="admin-masked-key">
                  Chave ativa: <code>{config.apiKeyMasked}</code>
                </p>
                {openAiSourceLabel && (
                  <p className="admin-key-source">{openAiSourceLabel}</p>
                )}
                {config.updatedAt && config.storedInDatabase && (
                  <p className="admin-key-source">
                    Atualizada em{' '}
                    {new Date(config.updatedAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>
            )}

            <label className="admin-field">
              <span>{config?.storedInDatabase ? 'Nova API Key (opcional)' : 'API Key'}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  config?.storedInDatabase
                    ? 'Deixe em branco para manter a chave atual'
                    : config?.credentialsSource === 'env'
                      ? 'Cole aqui ou use o botão abaixo para cadastrar a do servidor'
                      : 'sk-proj-...'
                }
                autoComplete="new-password"
                disabled={loading || saving}
              />
            </label>

            {config?.credentialsSource === 'env' && !config.storedInDatabase && (
              <div className="admin-key-import">
                <p className="admin-hint">
                  A chave do <code>.env</code> funciona como fallback. Cadastre no banco para
                  fixar por empresa no whitelabel.
                </p>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={handleImportEnvKey}
                  disabled={loading || saving}
                >
                  {saving ? 'Salvando…' : 'Cadastrar chave do servidor no banco'}
                </button>
              </div>
            )}

            <div className="admin-grid">
              <label className="admin-field">
                <span>Modelo (chat)</span>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                  disabled={loading || saving}
                />
              </label>
              <label className="admin-field">
                <span>Modelo (Whisper)</span>
                <input
                  type="text"
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  required
                  disabled={loading || saving}
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
                  disabled={loading || saving}
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
                  disabled={loading || saving}
                />
              </label>
            </div>

            <div className="admin-form-actions">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={saving || loading || !openAiCanSave}
              >
                {saving ? 'Salvando…' : 'Salvar credenciais'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card admin-card-muted admin-card-new">
          <CardHead
            icon="✨"
            title="Nova empresa"
            description="Cadastre um cliente whitelabel. Use o slug no header X-Tenant-Slug."
          />
          <form onSubmit={handleCreateTenant} className="admin-form">
            <p className="admin-hint">
              Identificador usado no front: <code>X-Tenant-Slug</code>
            </p>
            <div className="admin-grid">
              <label className="admin-field">
                <span>Nome da empresa</span>
                <input
                  type="text"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Ex.: Clínica Esperança"
                  required
                  disabled={loading}
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
                  disabled={loading}
                />
              </label>
            </div>
            <button type="submit" className="admin-btn admin-btn-secondary" disabled={loading}>
              Cadastrar empresa
            </button>
          </form>
        </section>
        </div>

        <img className="admin-footer-brand-logo" src="/crescere-logo.png" alt="Crescere" />
      </div>
    </div>
  )
}
