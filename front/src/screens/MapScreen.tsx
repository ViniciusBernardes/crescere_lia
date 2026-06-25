import { useEffect, useMemo } from 'react'
import { useLia } from '../context/LiaContext'

function moodDesc(e: string): string {
  const map: Record<string, string> = {
    'No limite': 'Você chegou sentindo estar no limite — seu corpo pedindo pausa urgente.',
    'Cansado(a)': 'Sinal de amor prolongado precisando de reposição. O cansaço é real e válido.',
    'Confuso(a)': 'Comum quando há muita informação e pouco apoio. Vamos organizar juntos.',
    'Estou bem': 'Ótimo momento para aprendizado preventivo e fortalecimento.',
    'Não sei dizer': 'Não nomear também é um sinal. Vamos explorar juntos com calma.',
  }
  return map[e] ?? e
}

function suggestFor(e: string): string {
  const map: Record<string, string> = {
    'No limite': 'Jornada 9 — Momentos de Crise',
    'Cansado(a)': 'Jornada 5 — Cuidar de Si',
    'Confuso(a)': 'Jornada 2 — Compreendendo o TEA',
    'Estou bem': 'Jornada 10 — Como o Cérebro Aprende',
    'Não sei dizer': 'Jornada 4 — Autoavaliação',
  }
  return map[e] ?? 'Continue com a Lia'
}

function roleDesc(r: string): string {
  const map: Record<string, string> = {
    'Tenho me sentido invisível': 'Suas necessidades têm ficado em segundo plano há algum tempo.',
    'Tento equilibrar': 'Você tenta equilibrar, mas acaba se colocando por último com frequência.',
    'Sinto culpa quando penso em mim': 'Você associa autocuidado a egoísmo — um peso desnecessário de carregar.',
    'Preciso cuidar mais de mim': 'Você reconhece a necessidade. Reconhecer já é o primeiro passo.',
    'Consigo às vezes': 'Você já acessa o autocuidado mas precisa de mais sustentação externa.',
  }
  return map[r] ?? r
}

function nextStep(profile: ReturnType<typeof useLia>['profile']): string {
  if (!profile.emotionToday) return 'Compartilhe como você está para receber orientações personalizadas.'
  const n = profile.journeysCompleted.length
  if (n === 0) return 'Inicie a Jornada 1 — Acolhimento e Chegada.'
  if (n < 3) return `Continue sua jornada — ${12 - n} trilhas ainda a explorar.`
  return 'Você está progredindo bem! Explore as jornadas avançadas.'
}

function MapBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mbar-row">
      <div className="mbar-label">
        {label} <span>{pct}%</span>
      </div>
      <div className="mbar-track">
        <div
          className="mbar-fill"
          data-w={pct}
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        />
      </div>
    </div>
  )
}

function MapCard({
  icon,
  title,
  body,
  tag,
}: {
  icon: string
  title: string
  body: string
  tag: string
}) {
  return (
    <div className="map-card">
      <div className="mc-header">
        <span className="mc-icon">{icon}</span>
        <span className="mc-title">{title}</span>
      </div>
      <div className="mc-body">{body}</div>
      <span className="mc-tag">{tag}</span>
    </div>
  )
}

export function MapScreen() {
  const { profile, showScreen } = useLia()
  const p = profile

  const metrics = useMemo(() => {
    const stress = Math.min(100, p.stressLevel * 10)
    const sc = Math.min(100, p.selfcareLevel * 10)
    const awareness = Math.min(100, p.responses.length * 12)
    const engagement = Math.min(100, p.journeysCompleted.length * 25 + p.responses.length * 4)
    return { stress, sc, awareness, engagement }
  }, [p])

  const empty = !p.emotionToday && p.responses.length === 0

  useEffect(() => {
    document.querySelectorAll('.mbar-fill').forEach((b) => {
      const el = b as HTMLElement
      el.style.width = `${el.dataset.w}%`
    })
  }, [metrics, empty])

  return (
    <div className="screen slide-in" id="mapScreen">
      <div className="map-top">
        <button
          type="button"
          className="hdr-back"
          onClick={() => showScreen('chat')}
          style={{ marginBottom: 12, background: 'rgba(255,255,255,0.2)', color: 'white' }}
        >
          ‹ Voltar
        </button>
        <h2>Meu Mapa Emocional</h2>
        <p>Baseado nas suas respostas com a Lia</p>
      </div>
      <div className="map-scroll">
        {empty ? (
          <div className="map-empty">
            <div className="me-icon">🗺️</div>
            <p>
              Seu mapa emocional aparece aqui conforme você interage com a Lia.
              <br />
              <br />
              Comece uma jornada para gerar seus primeiros insights.
            </p>
          </div>
        ) : (
          <>
            <div className="map-summary">
              <div className="ms-title">📊 Perfil emocional atual</div>
              <div className="map-bars">
                <MapBar label="Nível de sobrecarga" pct={metrics.stress} color="#E87777" />
                <MapBar label="Autocuidado percebido" pct={metrics.sc} color="#5CC878" />
                <MapBar label="Consciência emocional" pct={metrics.awareness} color="#8B6BB1" />
                <MapBar label="Engajamento nas jornadas" pct={metrics.engagement} color="#5BA8D4" />
              </div>
            </div>
            <div className="map-cards">
              {p.emotionToday && (
                <MapCard
                  icon="😌"
                  title="Como você chegou hoje"
                  body={moodDesc(p.emotionToday)}
                  tag={suggestFor(p.emotionToday)}
                />
              )}
              {p.emotionsFound.length > 0 && (
                <MapCard
                  icon="💭"
                  title="Emoções identificadas"
                  body={p.emotionsFound.slice(0, 3).join(' · ')}
                  tag="Continuar explorando na Jornada 3"
                />
              )}
              {p.caregiverRole && (
                <MapCard
                  icon="🧩"
                  title="Seu papel como cuidador"
                  body={roleDesc(p.caregiverRole)}
                  tag="Aprofundar na Jornada 5"
                />
              )}
              {p.challengeArea && (
                <MapCard
                  icon="🎯"
                  title="Principal área de desafio"
                  body={p.challengeArea}
                  tag="Estratégias na Jornada 6"
                />
              )}
              {p.journeysCompleted.length > 0 && (
                <MapCard
                  icon="✅"
                  title="Jornadas concluídas"
                  body={`${p.journeysCompleted.length} de 12 trilhas`}
                  tag="Continue seu progresso"
                />
              )}
              <MapCard icon="💡" title="Próximo passo" body={nextStep(p)} tag="Ver todas as jornadas" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
