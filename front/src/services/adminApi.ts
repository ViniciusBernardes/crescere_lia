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

const API_BASE = '/api/admin'
const TOKEN_KEY = 'lia_admin_token'

export function getAdminToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })

  const data = (await res.json()) as T & { message?: string }
  if (!res.ok) {
    throw new Error(data.message || `Erro (${res.status})`)
  }
  return data
}

export async function verifyAdminToken(): Promise<boolean> {
  await adminFetch<{ ok: boolean }>('/verify', { method: 'POST' })
  return true
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
