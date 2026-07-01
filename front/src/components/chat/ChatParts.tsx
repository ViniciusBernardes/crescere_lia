const LIA_AVATAR = '/lia.jpeg'

export function LiaAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={`mavatar${size === 'md' ? ' hdr-avatar' : ''}`}>
      <img src={LIA_AVATAR} alt="Lia" onError={(e) => (e.currentTarget.style.display = 'none')} />
    </div>
  )
}

export function ListenButton({
  text,
  onListen,
  onPrime,
  loading,
}: {
  text: string
  onListen: (t: string) => void
  onPrime?: () => void
  loading?: boolean
}) {
  return (
    <button
      type="button"
      className={`listen-btn${loading ? ' listen-btn--loading' : ''}`}
      onPointerDown={() => onPrime?.()}
      onClick={() => onListen(text)}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className="listen-spinner" aria-hidden />
          Carregando áudio…
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          Ouvir
        </>
      )}
    </button>
  )
}

export function HtmlContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br>') }} />
}
