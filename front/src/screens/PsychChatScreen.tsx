import { useCallback, useEffect, useRef, useState } from 'react'
import { useLia } from '../context/LiaContext'

interface Message {
  id: number
  sender_type: 'psychologist' | 'caregiver'
  body: string
  created_at: string
}

const API_BASE = '/api'

export function PsychChatScreen() {
  const { showScreen } = useLia()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'waiting' | 'active' | 'ended'>('waiting')
  const [attendanceId, setAttendanceId] = useState<number | null>(null)
  const cursorRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    checkAttendance()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!attendanceId) return
    pollMessages()
    pollRef.current = setInterval(pollMessages, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [attendanceId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function checkAttendance() {
    try {
      const res = await fetch(`${API_BASE}/chat/psych/status`, {
        headers: { 'X-Tenant-Slug': getTenantSlug() },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.attendance_id) {
          setAttendanceId(data.attendance_id)
          setStatus(data.status === 'in_progress' ? 'active' : 'waiting')
        }
      }
    } catch {
      // will retry via polling
    }
  }

  async function pollMessages() {
    if (!attendanceId) return
    try {
      const res = await fetch(
        `${API_BASE}/chat/psych/messages?attendance_id=${attendanceId}&after=${cursorRef.current}`,
        { headers: { 'X-Tenant-Slug': getTenantSlug() } },
      )
      if (!res.ok) return
      const data = await res.json()
      if (data.attendance_status === 'in_progress') {
        setStatus('active')
      } else if (data.attendance_status === 'completed') {
        setStatus('ended')
      }
      if (data.messages?.length) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m.id))
          if (!newMsgs.length) return prev
          const merged = [...prev, ...newMsgs]
          cursorRef.current = merged[merged.length - 1].id
          return merged
        })
      }
    } catch {
      // silent
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !attendanceId) return
    setInput('')
    try {
      const res = await fetch(`${API_BASE}/chat/psych/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': getTenantSlug(),
        },
        body: JSON.stringify({ attendance_id: attendanceId, body: text }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          cursorRef.current = msg.id
          return [...prev, msg]
        })
      }
    } catch {
      // restore input on error
      setInput(text)
    }
  }, [input, attendanceId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="psych-chat-screen">
      <div className="pcs-header">
        <button type="button" className="pcs-back" onClick={() => showScreen('chat')}>
          ←
        </button>
        <div className="pcs-title">💜 Plantão Psicológico</div>
      </div>

      <div className="pcs-messages" ref={scrollRef}>
        {status === 'waiting' && messages.length === 0 && (
          <div className="pcs-status">
            <div className="pcs-status-icon">💜</div>
            <p>Aguardando psicólogo aceitar o atendimento…</p>
            <p className="pcs-hint">Você será avisado assim que iniciar.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`pcs-bubble ${msg.sender_type === 'caregiver' ? 'pcs-mine' : 'pcs-theirs'}`}
          >
            <p>{msg.body}</p>
            <span className="pcs-time">
              {msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </span>
          </div>
        ))}
        {status === 'ended' && (
          <div className="pcs-status">
            <p>Atendimento encerrado. Obrigada por conversar conosco. 💜</p>
          </div>
        )}
      </div>

      {status !== 'ended' ? (
        <div className="pcs-input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem…"
            rows={1}
            disabled={status === 'waiting'}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || status === 'waiting'}
            className="pcs-send"
          >
            ➤
          </button>
        </div>
      ) : (
        <div className="pcs-input-area">
          <button
            type="button"
            className="pcs-back-full"
            onClick={() => showScreen('chat')}
          >
            Voltar ao chat
          </button>
        </div>
      )}
    </div>
  )
}

function getTenantSlug(): string {
  const meta = document.querySelector('meta[name="tenant-slug"]')
  if (meta) return meta.getAttribute('content') || 'crescere'
  return import.meta.env.VITE_TENANT_SLUG || 'crescere'
}
