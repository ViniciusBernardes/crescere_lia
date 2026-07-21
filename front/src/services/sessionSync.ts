import type { UserProfile } from '../types/profile'
import { getCaregiverIdentity } from './caregiverIdentity'
import { getTenantSlug } from './liaApi'

const STORAGE_KEY = 'lia_session_token'

function randomToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function getSessionToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim()
    if (existing) return existing
    const token = randomToken()
    localStorage.setItem(STORAGE_KEY, token)
    return token
  } catch {
    return randomToken()
  }
}

export function resolveTenantFromQuery(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('tenant')?.trim().toLowerCase() || null
}

/** Headers for plantão psicológico — inclui session_token da sessão atual. */
export function getPsychApiHeaders(): Record<string, string> {
  return {
    'X-Tenant-Slug': resolveTenantFromQuery() || getTenantSlug(),
    'X-Lia-Session-Token': getSessionToken(),
  }
}

export async function syncCaregiverProfile(
  profile: UserProfile,
  options?: {
    needsPsych?: boolean
    displayName?: string
    patientId?: number | null
    /** Keep request alive during page unload / tab close. */
    keepalive?: boolean
  },
): Promise<void> {
  const tenant = resolveTenantFromQuery() || getTenantSlug()
  const sessionToken = getSessionToken()
  const identity = getCaregiverIdentity()
  const displayName = options?.displayName?.trim() || identity?.displayName || undefined

  const body: Record<string, unknown> = {
    sessionToken,
    displayName,
    profile,
  }

  // Only send needsPsych when explicitly set — otherwise preserve the plantão flag server-side.
  if (typeof options?.needsPsych === 'boolean') {
    body.needsPsych = options.needsPsych
  }

  if (typeof options?.patientId === 'number' || options?.patientId === null) {
    body.patientId = options.patientId
  } else if (typeof identity?.patientId === 'number') {
    body.patientId = identity.patientId
  }

  const res = await fetch('/api/sessions/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenant,
    },
    body: JSON.stringify(body),
    keepalive: options?.keepalive === true,
  })

  if (!res.ok) {
    throw new Error(`Falha ao sincronizar sessão (${res.status}).`)
  }
}

/** Remove a solicitação de plantão da fila do psicólogo. */
export async function releasePsychRequest(
  profile: UserProfile,
  options?: { keepalive?: boolean },
): Promise<void> {
  await syncCaregiverProfile(profile, {
    needsPsych: false,
    keepalive: options?.keepalive,
  })
}

export type CaregiverSessionSnapshot = {
  displayName: string | null
  patientId: number | null
  needsPsych: boolean
  profile: Record<string, unknown>
}

/** Carrega perfil e metadados da sessão persistidos no servidor. */
export async function fetchCaregiverSession(): Promise<CaregiverSessionSnapshot | null> {
  const res = await fetch('/api/sessions/me', {
    headers: getPsychApiHeaders(),
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error('Não foi possível restaurar a sessão.')
  }
  return (await res.json()) as CaregiverSessionSnapshot
}
