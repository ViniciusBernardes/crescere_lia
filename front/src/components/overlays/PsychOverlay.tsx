import { useLia } from '../../context/LiaContext'

export function PsychOverlay() {
  const { psychOpen, closePsych } = useLia()
  if (!psychOpen) return null

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePsych()
      }}
      role="dialog"
      aria-modal
      aria-labelledby="psych-title"
    >
      <div className="sheet">
        <div className="ps-handle" />
        <div className="ps-icon">💜</div>
        <div className="ps-title" id="psych-title">
          Plantão Psicológico
        </div>
        <div className="ps-sub">
          Um psicólogo está disponível agora para te acolher. Espaço seguro e sigiloso.
        </div>
        <div className="ps-features">
          <div className="ps-feat">
            <span className="pf-check">💜</span>
            <span className="pf-text">Escuta qualificada e acolhedora</span>
          </div>
          <div className="ps-feat">
            <span className="pf-check">🔒</span>
            <span className="pf-text">Atendimento sigiloso</span>
          </div>
          <div className="ps-feat">
            <span className="pf-check">⚡</span>
            <span className="pf-text">Disponível 24h, 7 dias por semana</span>
          </div>
        </div>
        <button type="button" className="ps-cta" onClick={closePsych}>
          Iniciar atendimento agora
        </button>
        <button type="button" className="ps-cancel" onClick={closePsych}>
          Voltar
        </button>
      </div>
    </div>
  )
}
