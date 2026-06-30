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

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
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
