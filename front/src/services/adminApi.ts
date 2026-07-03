import {
  AdminAuthError,
  clearAdminToken,
  getAdminToken,
} from './adminAuth'

export interface Tenant {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface OpenAiCredentialsPublic {
  tenantId: string
  tenantName: string
  tenantSlug: string
  configured: boolean
  storedInDatabase: boolean
  credentialsSource: 'database' | 'env' | 'none'
  apiKeyMasked: string | null
  model: string
  whisperModel: string
  maxTokens: number
  temperature: number
  updatedAt: string | null
}

export interface SaveOpenAiPayload {
  apiKey?: string
  model: string
  whisperModel: string
  maxTokens: number
  temperature: number
}

export interface PromptConfigPublic {
  tenantId: string
  tenantName: string
  tenantSlug: string
  systemPrompt: string
  isCustom: boolean
  defaultPrompt: string
  updatedAt: string | null
}

const API_BASE = '/api/admin'

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken()
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new Error(
      'Servidor indisponível. No localhost, suba o back com: cd back && npm run dev (ou docker compose up).',
    )
  }

  let data: T & { message?: string }
  try {
    data = (await res.json()) as T & { message?: string }
  } catch {
    throw new Error(
      res.ok
        ? 'Resposta inválida do servidor.'
        : `Erro (${res.status}) — verifique se o back está rodando em http://localhost:3000`,
    )
  }

  if (res.status === 401) {
    clearAdminToken()
    throw new AdminAuthError(data.message || 'Sessão expirada. Faça login novamente.')
  }

  if (!res.ok) {
    throw new Error(data.message || `Erro (${res.status})`)
  }
  return data
}

export async function fetchTenants(): Promise<Tenant[]> {
  const data = await adminFetch<{ tenants: Tenant[] }>('/tenants')
  return data.tenants
}

export async function createTenant(name: string, slug: string): Promise<Tenant> {
  const data = await adminFetch<{ tenant: Tenant }>('/tenants', {
    method: 'POST',
    body: JSON.stringify({ name, slug }),
  })
  return data.tenant
}

export async function fetchOpenAiCredentials(slug: string): Promise<OpenAiCredentialsPublic> {
  return adminFetch<OpenAiCredentialsPublic>(`/tenants/${encodeURIComponent(slug)}/openai`)
}

export async function saveOpenAiCredentials(
  slug: string,
  payload: SaveOpenAiPayload,
): Promise<OpenAiCredentialsPublic> {
  return adminFetch<OpenAiCredentialsPublic>(`/tenants/${encodeURIComponent(slug)}/openai`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function importEnvOpenAiCredentials(
  slug: string,
): Promise<OpenAiCredentialsPublic> {
  return adminFetch<OpenAiCredentialsPublic>(
    `/tenants/${encodeURIComponent(slug)}/openai/import-env`,
    { method: 'POST' },
  )
}

export async function fetchPromptConfig(slug: string): Promise<PromptConfigPublic> {
  return adminFetch<PromptConfigPublic>(`/tenants/${encodeURIComponent(slug)}/prompt`)
}

export async function savePromptConfig(
  slug: string,
  systemPrompt: string,
): Promise<PromptConfigPublic> {
  return adminFetch<PromptConfigPublic>(`/tenants/${encodeURIComponent(slug)}/prompt`, {
    method: 'PUT',
    body: JSON.stringify({ systemPrompt }),
  })
}
