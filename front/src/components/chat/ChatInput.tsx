import { useRef } from 'react'
import { useLia } from '../../context/LiaContext'

export function ChatInput() {
  const { sendMessage, toggleMic, isRecording, isTranscribing } = useLia()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const micBusy = isRecording || isTranscribing

  const handleSend = () => {
    if (micBusy) return
    const text = textareaRef.current?.value.trim()
    if (!text) return
    sendMessage(text)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
  }

  const micLabel = isTranscribing
    ? 'Transcrevendo áudio…'
    : isRecording
      ? 'Parar gravação e enviar'
      : 'Gravar mensagem de voz'

  return (
    <div className="input-area">
      <div className="input-wrap">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Compartilhe o que você sente…"
          onInput={(e) => autoResize(e.currentTarget)}
          onKeyDown={handleKey}
          disabled={micBusy}
        />
        <button
          type="button"
          className={`mic-btn${isRecording ? ' rec' : ''}${isTranscribing ? ' busy' : ''}`}
          onClick={toggleMic}
          disabled={isTranscribing}
          title={micLabel}
          aria-label={micLabel}
        >
          {isTranscribing ? '…' : isRecording ? '⏹️' : '🎙️'}
        </button>
      </div>
      <button
        type="button"
        className="send-btn"
        onClick={handleSend}
        disabled={micBusy}
        aria-label="Enviar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
