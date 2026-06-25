import { ChatInput } from '../components/chat/ChatInput'
import { MessageList } from '../components/chat/MessageList'
import { useLia } from '../context/LiaContext'

export function ChatScreen() {
  const { showScreen, toggleAudio, audioEnabled, progress, mapBadge, openPsych } = useLia()

  return (
    <div className="screen slide-in" id="chatScreen">
      <div className="chat-header">
        <button type="button" className="hdr-back" onClick={() => showScreen('intro')}>
          ‹
        </button>
        <div className="hdr-avatar">
          <img src="/lia.jpeg" alt="Lia" />
          <div className="online-dot" />
        </div>
        <div className="hdr-info">
          <div className="hdr-name">Lia</div>
          <div className="hdr-status">● Online agora</div>
        </div>
        <div className="hdr-actions">
          <button type="button" className="hdr-btn" onClick={toggleAudio} title="Ativar/desativar áudio">
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          <button type="button" className="hdr-btn" onClick={() => showScreen('journey')} title="Jornadas">
            🗺️
          </button>
          <div style={{ position: 'relative' }}>
            <button type="button" className="hdr-btn" onClick={() => showScreen('map')} title="Mapa emocional">
              📊
            </button>
            {mapBadge && <span className="badge-new">!</span>}
          </div>
        </div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <MessageList />
      <button type="button" className="psych-bar" onClick={openPsych}>
        <div className="pb-dot" />
        <div className="pb-main">
          <div className="pb-title">Plantão Psicológico 24h</div>
          <div className="pb-sub">Desejo conversar com um psicólogo</div>
        </div>
        <div className="pb-arrow">›</div>
      </button>
      <ChatInput />
    </div>
  )
}
