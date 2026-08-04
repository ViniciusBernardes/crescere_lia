import { useCallback, useEffect, useRef, useState } from 'react'
import { useLia } from '../../context/LiaContext'
import { showJourneys } from '../../lib/features'
import type { ChatMessage } from '../../types/chat'
import { HtmlContent, LiaAvatar, ListenButton } from './ChatParts'
import { AudioMessagePlayer } from './AudioMessagePlayer'

function MessageRow({ children, user }: { children: React.ReactNode; user?: boolean }) {
  return <div className={`mrow${user ? ' user' : ''}`}>{children}</div>
}

function AiBubble({
  html,
  audioText,
  extras,
  time,
}: {
  html: string
  audioText?: string
  extras?: string
  time: string
}) {
  const { listen, speechPlayerEnabled } = useLia()
  return (
    <MessageRow>
      <LiaAvatar />
      <div className="bwrap">
        <div className="bubble ai">
          <p>
            <HtmlContent html={html} />
          </p>
          {audioText &&
            (speechPlayerEnabled ? (
              <AudioMessagePlayer text={audioText} />
            ) : (
              <ListenButton text={audioText} onListen={listen} />
            ))}
          {extras && <HtmlContent html={extras} />}
        </div>
        <span className="btime">{time}</span>
      </div>
    </MessageRow>
  )
}

function PickerBubble({ msg }: { msg: Extract<ChatMessage, { kind: 'picker' }> }) {
  const { pickEmotion, listen, speechPlayerEnabled } = useLia()
  const [selected, setSelected] = useState<number | null>(null)

  const handlePick = (idx: number, label: string) => {
    if (selected !== null) return
    setSelected(idx)
    pickEmotion(msg.pickerId, idx, label)
  }

  return (
    <MessageRow>
      <LiaAvatar />
      <div className="bwrap">
        <div className="bubble ai">
          <p>
            <HtmlContent html={msg.question} />
          </p>
          {msg.audioQ &&
            (speechPlayerEnabled ? (
              <AudioMessagePlayer text={msg.audioQ} />
            ) : (
              <ListenButton text={msg.audioQ} onListen={listen} />
            ))}
          <div className="emotion-grid">
            {msg.pills.map((pill, idx) => (
              <button
                key={pill.label}
                type="button"
                className={`epill${selected === idx ? ' sel' : ''}${selected !== null && selected !== idx ? ' off' : ''}`}
                onClick={() => handlePick(idx, pill.label)}
                disabled={selected !== null}
              >
                {pill.emoji} {pill.label}
              </button>
            ))}
          </div>
        </div>
        <span className="btime">{msg.time}</span>
      </div>
    </MessageRow>
  )
}

function CtasBubble({ msg }: { msg: Extract<ChatMessage, { kind: 'ctas' }> }) {
  return (
    <MessageRow>
      <LiaAvatar />
      <div className="bwrap">
        <div className="bubble ai">
          <div className="cta-stack">
            {msg.buttons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                className={`ctabtn ${btn.style ?? 'secondary'}`}
                onClick={btn.action}
              >
                <span className="ci">{btn.icon}</span>
                <div className="ct">
                  {btn.label}
                  {btn.sub && <span className="cs">{btn.sub}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
        <span className="btime">{msg.time}</span>
      </div>
    </MessageRow>
  )
}

function SuggestBubble({ msg }: { msg: Extract<ChatMessage, { kind: 'suggest' }> }) {
  const { startJourney, openPsych } = useLia()
  const j = msg.journey
  if (!showJourneys()) return null
  return (
    <MessageRow>
      <LiaAvatar />
      <div className="bwrap">
        <div className="bubble ai">
          <p>Com base em como você está, sugiro:</p>
          <button type="button" className="jcard" onClick={() => startJourney(j.n)}>
            <div className="jci">{j.icon}</div>
            <div className="jct">
              <div className="jcl">Sugestão da Lia</div>
              <div className="jcn">
                J{j.n} — {j.title}
              </div>
            </div>
            <div className="jca">›</div>
          </button>
          <div className="cta-stack" style={{ marginTop: 8 }}>
            <button type="button" className="ctabtn accent" onClick={openPsych}>
              <span className="ci">💜</span>
              <div className="ct">
                Falar com psicólogo
                <span className="cs">Plantão disponível 24h</span>
              </div>
            </button>
          </div>
        </div>
        <span className="btime">{msg.time}</span>
      </div>
    </MessageRow>
  )
}

function youtubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      const embed = parsed.pathname.match(/\/embed\/([\w-]{6,})/)
      if (embed?.[1]) return `https://www.youtube.com/embed/${embed[1]}`
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    return null
  }
  return null
}

function MediaBubble({ msg }: { msg: Extract<ChatMessage, { kind: 'media' }> }) {
  return (
    <MessageRow>
      <LiaAvatar />
      <div className="bwrap">
        <div className="bubble ai">
          <p>Preparei estes conteúdos para esta jornada:</p>
          <div className="journey-media-stack">
            {msg.items.map((item, index) => {
              const key = `${item.kind}-${item.id ?? index}`
              const title = item.title || item.original_name || 'Anexo'
              if (item.kind === 'pdf') {
                return (
                  <a
                    key={key}
                    className="journey-media-card"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="journey-media-icon">📄</span>
                    <span>
                      <strong>{title}</strong>
                      <small>Abrir PDF</small>
                    </span>
                  </a>
                )
              }
              if (item.kind === 'audio') {
                return (
                  <div key={key} className="journey-media-card static">
                    <span className="journey-media-icon">🎧</span>
                    <div className="journey-media-body">
                      <strong>{title}</strong>
                      <audio controls preload="none" src={item.url}>
                        Seu navegador não reproduz áudio.
                      </audio>
                    </div>
                  </div>
                )
              }
              const embed = item.kind === 'video_link' ? youtubeEmbedUrl(item.url) : null
              if (embed) {
                return (
                  <div key={key} className="journey-media-card static">
                    <span className="journey-media-icon">🎬</span>
                    <div className="journey-media-body">
                      <strong>{title}</strong>
                      <div className="journey-media-frame">
                        <iframe
                          src={embed}
                          title={title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={key} className="journey-media-card static">
                  <span className="journey-media-icon">🎬</span>
                  <div className="journey-media-body">
                    <strong>{title}</strong>
                    <video controls preload="metadata" src={item.url}>
                      Seu navegador não reproduz vídeo.
                    </video>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <span className="btime">{msg.time}</span>
      </div>
    </MessageRow>
  )
}

export function MessageList() {
  const { messages } = useLia()
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef(0)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior })
  }, [])

  const scheduleScroll = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollToBottom(behavior)
      })
    },
    [scrollToBottom],
  )

  useEffect(() => {
    scheduleScroll()
  }, [messages, scheduleScroll])

  useEffect(() => {
    const inner = containerRef.current?.querySelector('.messages-inner')
    if (!inner) return

    const observer = new ResizeObserver(() => {
      scheduleScroll('auto')
    })
    observer.observe(inner)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(scrollRafRef.current)
    }
  }, [scheduleScroll])

  return (
    <div className="messages" ref={containerRef}>
      <div className="messages-inner">
        <div className="date-chip">
          <span>Hoje</span>
        </div>
      {messages.map((msg) => {
        if (msg.kind === 'typing') {
          return (
            <MessageRow key={msg.id}>
              <LiaAvatar />
              <div className="bwrap">
                <div className="typing-bubble" aria-label="Lia está digitando">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </MessageRow>
          )
        }
        if (msg.kind === 'user') {
          return (
            <MessageRow key={msg.id} user>
              <div className="bwrap">
                <div className="bubble user">
                  <p>{msg.text}</p>
                </div>
                <span className="btime">{msg.time}</span>
              </div>
              <div className="mavatar user-av">EU</div>
            </MessageRow>
          )
        }
        if (msg.kind === 'picker') return <PickerBubble key={msg.id} msg={msg} />
        if (msg.kind === 'ctas') return <CtasBubble key={msg.id} msg={msg} />
        if (msg.kind === 'suggest') return <SuggestBubble key={msg.id} msg={msg} />
        if (msg.kind === 'media') return <MediaBubble key={msg.id} msg={msg} />
        if (msg.kind === 'ai') {
          if (!msg.html?.trim()) return null
          return (
            <AiBubble
              key={msg.id}
              html={msg.html}
              audioText={msg.audioText}
              extras={msg.extras}
              time={msg.time}
            />
          )
        }
        return null
      })}
      </div>
    </div>
  )
}
