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
        <div className="intro-hero-glow" aria-hidden />
        <div className="intro-orb">
          <img src="/lia.jpeg" alt="Lia" loading="eager" />
        </div>
        <p className="intro-hero-badge">Assistente virtual</p>
        <h1>Olá, eu sou a Lia</h1>
        <p className="tagline">Crescere · Apoio ao Cuidador</p>
        <p className="intro-hero-lead">
          Acolhimento, orientação e escuta para quem cuida de uma criança com TEA.
        </p>
      </div>

      <div className="intro-body">
        <div className="intro-body-inner">
          <header className="intro-welcome">
            <p className="intro-eyebrow">Bem-vindo(a)</p>
            <p className="intro-quote">
              Se você está aqui, isso importa.
              <br />
              Este espaço foi criado <strong>para você</strong> — quem cuida de uma criança com TEA.
            </p>
          </header>

          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <article key={f.title} className="feat" style={{ animationDelay: `${0.08 + i * 0.06}s` }}>
                <div className="feat-icon" aria-hidden>
                  {f.icon}
                </div>
                <div className="feat-text">
                  <strong>{f.title}</strong>
                  <span>{f.desc}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="intro-actions">
            <button type="button" className="start-btn" onClick={goToChat}>
              Quero começar minha jornada
              <span className="btn-arrow" aria-hidden>
                →
              </span>
            </button>
            <p className="intro-cta-hint">Leva menos de 2 minutos · no seu ritmo</p>
            <p className="crescere-brand">Crescere</p>
          </div>
        </div>
      </div>
    </div>
  )
}
