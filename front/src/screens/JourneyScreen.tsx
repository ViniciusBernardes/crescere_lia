import { JOURNEYS } from '../data/journeys'
import { useLia } from '../context/LiaContext'

export function JourneyScreen() {
  const { profile, showScreen, startJourney } = useLia()

  return (
    <div className="screen slide-in" id="journeyScreen">
      <div className="screen-content">
        <header className="jm-top">
          <div className="page-inner">
            <button type="button" className="hdr-back jm-back" onClick={() => showScreen('chat')}>
              ‹ Voltar
            </button>
            <h2>Jornadas</h2>
            <p>12 trilhas de apoio ao cuidador — todas disponíveis</p>
          </div>
        </header>
        <div className="jm-scroll">
          <div className="page-inner jm-grid">
          {JOURNEYS.map((j) => {
            const done = profile.journeysCompleted.includes(j.n)
            return (
              <button
                key={j.n}
                type="button"
                className="jm-row"
                style={{ borderLeftColor: j.color, width: '100%', textAlign: 'left' }}
                onClick={() => startJourney(j.n)}
              >
                <div className="jm-icon">{j.icon}</div>
                <div className="jm-info">
                  <div className="jm-num">Jornada {j.n}</div>
                  <div className="jm-title">{j.title}</div>
                  <div className="jm-sub">{j.sub}</div>
                </div>
                {done ? (
                  <span className="jm-done">✓ Concluída</span>
                ) : (
                  <span style={{ fontSize: 14, color: 'var(--text-xlight)' }}>›</span>
                )}
              </button>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}
