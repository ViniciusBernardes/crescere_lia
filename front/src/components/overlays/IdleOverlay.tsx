import { useLia } from '../../context/LiaContext'

export function IdleOverlay() {
  const { idlePromptOpen, continueFromIdle, endFromIdle } = useLia()
  if (!idlePromptOpen) return null

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) continueFromIdle()
      }}
      role="dialog"
      aria-modal
      aria-labelledby="idle-title"
    >
      <div className="sheet">
        <div className="ps-handle" />
        <div className="ps-icon">💬</div>
        <div className="ps-title" id="idle-title">
          Vamos continuar?
        </div>
        <div className="ps-sub">
          Você ficou alguns instantes sem interagir. Gostaria de continuar conversando com a LIA ou
          encerrar esta conversa por agora?
        </div>
        <button type="button" className="ps-cta" onClick={continueFromIdle}>
          Continuar conversando
        </button>
        <button type="button" className="ps-cancel" onClick={endFromIdle}>
          Encerrar por enquanto
        </button>
      </div>
    </div>
  )
}
