import { useCallback, useEffect, useRef, useState } from 'react'
import { useLia } from '../context/LiaContext'
import { getPsychApiHeaders } from '../services/sessionSync'

interface Message {
  id: number
  sender_type: 'psychologist' | 'caregiver'
  body: string
  created_at: string
}

type IntegrationIssue = 'unavailable' | 'error' | 'network'

const API_BASE = '/api'
const STATUS_POLL_MS = 3000
const MESSAGE_POLL_MS = 3000
const REQUEST_TIMEOUT_MS = 12_000
const NETWORK_FAIL_THRESHOLD = 3

const INTEGRATION_MESSAGES: Record<IntegrationIssue, { title: string; detail: string }> = {
  unavailable: {
    title: 'Plantão indisponível no momento',
    detail:
      'A conexão com a plataforma Crescere não está ativa. Tente novamente em instantes ou volte ao chat.',
  },
  error: {
    title: 'Não foi possível consultar o plantão',
    detail: 'O serviço respondeu com erro. Use “Tentar novamente” ou cancele a solicitação.',
  },
  network: {
    title: 'Sem resposta do servidor',
    detail: 'Verifique sua internet e tente novamente. Se persistir, cancele e solicite o plantão depois.',
  },
}

async function fetchPsychStatus(signal?: AbortSignal) {
  const res = await fetch(`${API_BASE}/chat/psych/status`, {
    headers: getPsychApiHeaders(),
    signal,
  })
  const data = res.ok ? await res.json() : null
  return { res, data }
}

export function PsychChatScreen() {
  const { showScreen, openVideoCall, cancelPsychRequest } = useLia()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'waiting' | 'active' | 'ended'>('waiting')
  const [attendanceId, setAttendanceId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [integrationIssue, setIntegrationIssue] = useState<IntegrationIssue | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [messageSyncIssue, setMessageSyncIssue] = useState(false)
  const cursorRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusFailCountRef = useRef(0)
  const messageFailCountRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current)
      statusPollRef.current = null
    }
  }, [])

  const resolveIntegrationStatus = useCallback((apiStatus: string | undefined): IntegrationIssue | null => {
    if (apiStatus === 'unavailable') return 'unavailable'
    if (apiStatus === 'error' || apiStatus === 'no_tenant') return 'error'
    return null
  }, [])

  const checkAttendance = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const { res, data } = await fetchPsychStatus(controller.signal)
      window.clearTimeout(timeoutId)

      if (!res.ok || !data) {
        statusFailCountRef.current += 1
        if (statusFailCountRef.current >= NETWORK_FAIL_THRESHOLD && !attendanceId) {
          setIntegrationIssue('network')
        }
        return
      }

      statusFailCountRef.current = 0

      const issue = resolveIntegrationStatus(data.status)
      if (issue && !data.attendance_id) {
        setIntegrationIssue(issue)
        return
      }

      setIntegrationIssue(null)

      if (data.attendance_id) {
        if (data.channel === 'video') {
          stopPolling()
          openVideoCall()
          return
        }
        setAttendanceId(data.attendance_id)
        setStatus(data.status === 'in_progress' ? 'active' : 'waiting')
        if (data.status === 'in_progress' && statusPollRef.current) {
          clearInterval(statusPollRef.current)
          statusPollRef.current = null
        }
      }
    } catch {
      window.clearTimeout(timeoutId)
      statusFailCountRef.current += 1
      if (statusFailCountRef.current >= NETWORK_FAIL_THRESHOLD && !attendanceId) {
        setIntegrationIssue('network')
      }
    }
  }, [attendanceId, openVideoCall, resolveIntegrationStatus, stopPolling])

  useEffect(() => {
    void checkAttendance()
    statusPollRef.current = setInterval(() => {
      void checkAttendance()
    }, STATUS_POLL_MS)
    return stopPolling
  }, [checkAttendance, stopPolling])

  const pollMessages = useCallback(async () => {
    if (!attendanceId) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(
        `${API_BASE}/chat/psych/messages?attendance_id=${attendanceId}&after=${cursorRef.current}`,
        { headers: getPsychApiHeaders(), signal: controller.signal },
      )
      window.clearTimeout(timeoutId)

      if (!res.ok) {
        messageFailCountRef.current += 1
        if (messageFailCountRef.current >= NETWORK_FAIL_THRESHOLD) {
          setMessageSyncIssue(true)
        }
        return
      }

      messageFailCountRef.current = 0
      setMessageSyncIssue(false)

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
      window.clearTimeout(timeoutId)
      messageFailCountRef.current += 1
      if (messageFailCountRef.current >= NETWORK_FAIL_THRESHOLD) {
        setMessageSyncIssue(true)
      }
    }
  }, [attendanceId])

  useEffect(() => {
    if (!attendanceId) return
    void pollMessages()
    pollRef.current = setInterval(() => {
      void pollMessages()
    }, MESSAGE_POLL_MS)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [attendanceId, pollMessages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const canCancelWait = status === 'waiting' && attendanceId === null

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    statusFailCountRef.current = 0
    messageFailCountRef.current = 0
    setIntegrationIssue(null)
    setMessageSyncIssue(false)
    try {
      await checkAttendance()
      if (attendanceId) {
        await pollMessages()
      }
    } finally {
      setRetrying(false)
    }
  }, [attendanceId, checkAttendance, pollMessages])

  const handleCancelWait = useCallback(async () => {
    if (!canCancelWait || cancelling) return
    if (!window.confirm('Cancelar a solicitação de plantão?')) return

    setCancelling(true)
    stopPolling()
    try {
      await cancelPsychRequest()
    } finally {
      setCancelling(false)
    }
  }, [canCancelWait, cancelPsychRequest, cancelling, stopPolling])

  const handleBack = useCallback(() => {
    if (canCancelWait) {
      void handleCancelWait()
      return
    }
    showScreen('chat')
  }, [canCancelWait, handleCancelWait, showScreen])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !attendanceId) return
    setInput('')
    try {
      const res = await fetch(`${API_BASE}/chat/psych/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getPsychApiHeaders(),
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
        setMessageSyncIssue(false)
        messageFailCountRef.current = 0
      } else {
        setInput(text)
        setMessageSyncIssue(true)
      }
    } catch {
      setInput(text)
      setMessageSyncIssue(true)
    }
  }, [input, attendanceId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const issueCopy = integrationIssue ? INTEGRATION_MESSAGES[integrationIssue] : null

  return (
    <div className="psych-chat-screen">
      <div className="pcs-header">
        <button type="button" className="pcs-back" onClick={handleBack} aria-label="Voltar">
          ←
        </button>
        <div className="pcs-title">💜 Plantão Psicológico</div>
      </div>

      {messageSyncIssue && status === 'active' ? (
        <div className="pcs-integration-banner" role="status">
          <span>Conexão instável — mensagens podem atrasar.</span>
          <button type="button" className="pcs-retry-inline" onClick={() => void handleRetry()} disabled={retrying}>
            {retrying ? '…' : 'Atualizar'}
          </button>
        </div>
      ) : null}

      <div className="pcs-messages" ref={scrollRef}>
        {integrationIssue && issueCopy && status === 'waiting' && messages.length === 0 ? (
          <div className="pcs-status pcs-status--error">
            <div className="pcs-status-icon" aria-hidden>
              ⚠️
            </div>
            <p className="pcs-error-title">{issueCopy.title}</p>
            <p className="pcs-hint">{issueCopy.detail}</p>
            <div className="pcs-error-actions">
              <button
                type="button"
                className="pcs-retry"
                onClick={() => void handleRetry()}
                disabled={retrying}
              >
                {retrying ? 'Tentando…' : 'Tentar novamente'}
              </button>
              {canCancelWait ? (
                <button
                  type="button"
                  className="pcs-cancel-wait"
                  onClick={() => void handleCancelWait()}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelando…' : 'Cancelar solicitação'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {status === 'waiting' && messages.length === 0 && !integrationIssue ? (
          <div className="pcs-status">
            <div className="pcs-status-icon">💜</div>
            <p>Aguardando psicólogo aceitar o atendimento…</p>
            <p className="pcs-hint">Você será avisado assim que iniciar.</p>
            {canCancelWait ? (
              <button
                type="button"
                className="pcs-cancel-wait"
                onClick={() => void handleCancelWait()}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando…' : 'Cancelar espera'}
              </button>
            ) : null}
          </div>
        ) : null}

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

        {status === 'ended' ? (
          <div className="pcs-status">
            <p>Atendimento encerrado. Obrigada por conversar conosco. 💜</p>
          </div>
        ) : null}
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
          <button type="button" className="pcs-back-full" onClick={() => showScreen('chat')}>
            Voltar ao chat
          </button>
        </div>
      )}
    </div>
  )
}
