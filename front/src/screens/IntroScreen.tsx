import { useLia } from '../context/LiaContext'

const FEATURES = [
  { icon: '📚', title: 'Psicoeducação acolhedora', desc: 'Informação clara sobre TEA em linguagem humana' },
  { icon: '💙', title: 'Suporte emocional', desc: 'Espaço seguro para falar sobre seus sentimentos' },
  { icon: '🗺️', title: 'Mapa comportamental', desc: 'Insights personalizados com base nas suas respostas' },
  { icon: '🕐', title: 'Plantão psicológico 24h', desc: 'Apoio humano sempre que você precisar' },
]

export function IntroScreen() {
  const { goToChat } = useLia()

  return (
    <div className="screen slide-in" id="introScreen">
      <div className="intro-hero">
        <div className="intro-orb">
          <img src="/lia.jpeg" alt="Lia" loading="eager" />
        </div>
        <h1>Olá, eu sou a Lia</h1>
        <p className="tagline">Crescere · Apoio ao Cuidador</p>
      </div>
      <div className="intro-body">
        <div className="intro-body-inner">
          <p className="intro-eyebrow">Bem-vindo(a)</p>
          <p className="intro-quote">
            Se você está aqui, isso importa.
            <br />
            Este espaço foi criado <strong>para você</strong> — quem cuida de uma criança com TEA.
          </p>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="feat">
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-text">
                  <strong>{f.title}</strong>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="intro-actions">
            <button type="button" className="start-btn" onClick={goToChat}>
              Quero começar minha jornada <span className="btn-arrow">→</span>
            </button>
            <p className="crescere-brand">Crescere</p>
          </div>
        </div>
      </div>
    </div>
  )
}
