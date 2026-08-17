import { resolveTenantSlug } from '../utils/tenant'

export type CaregiverLoginResult = {
  id: number
  name: string
  email: string
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  return data.message || fallback
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

export async function forgotCaregiverPassword(email: string): Promise<string> {
  const res = await fetch('/api/auth/forgot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': resolveTenantSlug(),
    },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Não foi possível solicitar a redefinição.'))
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string }
  return (
    data.message ||
    'Se o e-mail estiver cadastrado, enviamos instruções. Caso contrário, fale com o RH/admin.'
  )
}

export async function resetCaregiverPassword(payload: {
  email: string
  token: string
  password: string
  passwordConfirmation: string
}): Promise<string> {
  const res = await fetch('/api/auth/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payload.email,
      token: payload.token,
      password: payload.password,
      password_confirmation: payload.passwordConfirmation,
    }),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Não foi possível redefinir a senha.'))
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string }
  return data.message || 'Senha atualizada com sucesso.'
}
