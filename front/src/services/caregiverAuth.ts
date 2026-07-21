import { resolveTenantSlug } from '../utils/tenant'

export type CaregiverLoginResult = {
  id: number
  name: string
  email: string
}

export async function loginCaregiver(
  email: string,
  password: string,
): Promise<CaregiverLoginResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': resolveTenantSlug(),
    },
    body: JSON.stringify({ email, password }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    patient?: { id: number; name: string; email: string }
  }

  if (!res.ok || !data.patient) {
    throw new Error(data.message || 'E-mail ou senha inválidos.')
  }

  return {
    id: data.patient.id,
    name: data.patient.name,
    email: data.patient.email,
  }
}
