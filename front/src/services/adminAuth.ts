const TOKEN_KEY = 'lia-admin-session-token'

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export async function loginAdmin(username: string, password: string): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('Servidor indisponível. Verifique se o back está rodando.')
  }

  const data = (await res.json()) as { token?: string; message?: string }
  if (!res.ok || !data.token) {
    throw new Error(data.message || 'Usuário ou senha inválidos.')
  }

  setAdminToken(data.token)
  return data.token
}

export async function verifyAdminSession(): Promise<void> {
  const token = getAdminToken()
  if (!token) throw new AdminAuthError('Não autenticado')

  const res = await fetch('/api/admin/session', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (res.status === 401) {
    clearAdminToken()
    throw new AdminAuthError('Sessão expirada')
  }

  if (!res.ok) {
    const data = (await res.json()) as { message?: string }
    throw new Error(data.message || 'Não foi possível validar a sessão.')
  }
}
