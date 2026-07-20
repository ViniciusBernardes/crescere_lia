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

export async function syncCaregiverProfile(
  profile: UserProfile,
  options?: { needsPsych?: boolean; displayName?: string },
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

  if (typeof identity?.patientId === 'number') {
    body.patientId = identity.patientId
  }

  await fetch('/api/sessions/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenant,
    },
    body: JSON.stringify(body),
  })
}
