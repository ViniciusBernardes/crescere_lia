import { ChatInput } from '../components/chat/ChatInput'
import { MessageList } from '../components/chat/MessageList'
import { useLia } from '../context/LiaContext'

export function ChatScreen() {
  const {
    showScreen,
    toggleAudio,
    audioEnabled,
    audioNotice,
    dismissAudioNotice,
    progress,
    mapBadge,
    openPsych,
  } = useLia()

  return (
    <div className="screen slide-in" id="chatScreen">
      <div className="screen-content">
        <header className="chat-header">
          <div className="chat-header-row">
            <button type="button" className="hdr-back" onClick={() => showScreen('intro')} aria-label="Voltar">
              ‹
            </button>
            <div className="hdr-avatar hdr-avatar--chat">
              <img src="/lia.jpeg" alt="Lia" />
              <div className="online-dot" />
            </div>
            <div className="hdr-info">
              <div className="hdr-name">Lia</div>
              <div className="hdr-status">
                <span className="status-pulse" />
                <span className="hdr-status-short">Online agora</span>
                <span className="hdr-status-long"> · Apoio ao cuidador</span>
              </div>
            </div>
            <div className="hdr-actions">
              <button
                type="button"
                className={`hdr-btn${audioEnabled ? ' active' : ''}${audioNotice ? ' hdr-btn--hint' : ''}`}
                onClick={toggleAudio}
                title={audioEnabled ? 'Desativar áudio da Lia' : 'Ativar áudio da Lia (voz nova)'}
              >
                {audioEnabled ? '🔊' : '🔇'}
              </button>
              <button type="button" className="hdr-btn" onClick={() => showScreen('journey')} title="Jornadas">
                🗺️
              </button>
              <div className="hdr-btn-wrap">
                <button type="button" className="hdr-btn" onClick={() => showScreen('map')} title="Mapa emocional">
                  📊
                </button>
                {mapBadge && <span className="badge-new">!</span>}
              </div>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-meta">
              <span>Sua jornada</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {audioNotice && (
          <div className="audio-notice" role="status">
            <p>
              Para ouvir a Lia, ative o áudio <strong>🔊</strong> no canto superior direito.
            </p>
            <button
              type="button"
              className="audio-notice-close"
              onClick={dismissAudioNotice}
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        )}

        <MessageList />

        <div className="chat-footer">
          <button type="button" className="psych-bar" onClick={openPsych}>
            <div className="pb-icon">💜</div>
            <div className="pb-main">
              <div className="pb-title">Plantão Psicológico 24h</div>
              <div className="pb-sub">Desejo conversar com um psicólogo</div>
            </div>
            <div className="pb-arrow">›</div>
          </button>
          <ChatInput />
        </div>
      </div>
    </div>
  )
}
