import { useState } from 'react'
import { useLia } from '../context/LiaContext'

type LogoutButtonProps = {
  className?: string
  variant?: 'text' | 'icon'
}

export function LogoutButton({ className = '', variant = 'text' }: LogoutButtonProps) {
  const { logout } = useLia()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    if (!window.confirm('Deseja sair da sua conta?')) return

    setLoading(true)
    try {
      await logout()
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`hdr-btn hdr-btn--logout ${className}`.trim()}
        onClick={() => void handleClick()}
        disabled={loading}
        title="Sair"
        aria-label="Sair da conta"
      >
        ⎋
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`logout-btn ${className}`.trim()}
      onClick={() => void handleClick()}
      disabled={loading}
    >
      {loading ? 'Saindo…' : 'Sair'}
    </button>
  )
}
