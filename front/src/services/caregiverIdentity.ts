const STORAGE_KEY = 'lia_caregiver_identity'

export type CaregiverIdentity = {
  email: string
  displayName: string
}

function readRaw(): CaregiverIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CaregiverIdentity>
    const email = typeof parsed.email === 'string' ? parsed.email.trim() : ''
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName.trim() : ''
    if (!email || !displayName) return null
    return { email, displayName }
  } catch {
    return null
  }
}

export function getCaregiverIdentity(): CaregiverIdentity | null {
  return readRaw()
}

export function hasCaregiverIdentity(): boolean {
  return readRaw() !== null
}

export function setCaregiverIdentity(identity: CaregiverIdentity): void {
  const email = identity.email.trim().toLowerCase()
  const displayName = identity.displayName.trim()
  if (!email || !displayName) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, displayName }))
  } catch {
    // ignore quota / private mode
  }
}

export function clearCaregiverIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Deriva um nome legível a partir do e-mail (ex.: ana.silva@x.com → Ana Silva). */
export function displayNameFromEmail(email: string): string {
  const local = email.trim().split('@')[0] ?? ''
  const parts = local.split(/[._+-]+/).filter(Boolean)
  if (parts.length === 0) return 'Cuidador'
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
}
