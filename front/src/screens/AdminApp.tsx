import { useCallback, useEffect, useState } from 'react'
import { AdminAuthError, clearAdminToken, verifyAdminSession } from '../services/adminAuth'
import { AdminLoginScreen } from './AdminLoginScreen'
import { AdminScreen } from './AdminScreen'

export function AdminApp() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  const checkSession = useCallback(async () => {
    try {
      await verifyAdminSession()
      setAuthed(true)
    } catch (err) {
      if (!(err instanceof AdminAuthError)) {
        console.warn('[admin] sessão:', err)
      }
      setAuthed(false)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  const handleLogout = () => {
    clearAdminToken()
    setAuthed(false)
  }

  if (!ready) {
    return (
      <div className="admin-page admin-login-page">
        <div className="admin-login-shell">
          <div className="admin-loading" role="status">
            <span className="admin-loading-dot" aria-hidden />
            Verificando sessão…
          </div>
        </div>
      </div>
    )
  }

  if (!authed) {
    return <AdminLoginScreen onSuccess={() => setAuthed(true)} />
  }

  return <AdminScreen onLogout={handleLogout} />
}
