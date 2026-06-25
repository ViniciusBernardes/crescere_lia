import { useState } from 'react'
import { useLia } from '../../context/LiaContext'
import type { ChatMessage } from '../../types/chat'
import { HtmlContent, LiaAvatar, ListenButton } from './ChatParts'

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
  const { listen } = useLia()
  return (
    <MessageRow>
      <LiaAvatar />
      <div className="bwrap">
        <div className="bubble ai">
          <p>
            <HtmlContent html={html} />
          </p>
          {audioText && <ListenButton text={audioText} onListen={listen} />}
          {extras && <HtmlContent html={extras} />}
        </div>
        <span className="btime">{time}</span>
      </div>
    </MessageRow>
  )
}

function PickerBubble({ msg }: { msg: Extract<ChatMessage, { kind: 'picker' }> }) {
  const { listen, pickEmotion } = useLia()
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
          {msg.audioQ && <ListenButton text={msg.audioQ} onListen={listen} />}
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
  const { startJourney, showScreen, openPsych } = useLia()
  const j = msg.journey
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
            <button type="button" className="ctabtn secondary" onClick={() => showScreen('journey')}>
              <span className="ci">🗺️</span>
              <div className="ct">Ver todas as jornadas</div>
            </button>
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

export function MessageList() {
  const { messages } = useLia()

  return (
    <div className="messages">
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
        if (msg.kind === 'ai') {
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
