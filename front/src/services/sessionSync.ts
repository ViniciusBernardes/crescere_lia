import type { UserProfile } from '../types/profile'
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

  await fetch('/api/sessions/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenant,
    },
    body: JSON.stringify({
      sessionToken,
      displayName: options?.displayName,
      needsPsych: options?.needsPsych ?? false,
      profile,
    }),
  })
}
