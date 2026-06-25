export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="frame">
      <div className="phone">{children}</div>
    </div>
  )
}

export function StatusBar() {
  return (
    <>
      <div className="notch" />
      <div className="statusbar">
        <span className="statusbar-time">9:41</span>
        <div className="statusbar-icons">
          <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
            <rect x="0" y="3" width="3" height="8" rx="1" />
            <rect x="4.5" y="1.5" width="3" height="9.5" rx="1" />
            <rect x="9" y="0" width="3" height="11" rx="1" />
            <rect x="13.5" y="0" width="2.5" height="11" rx="1" opacity="0.3" />
          </svg>
          <span>🔋</span>
        </div>
      </div>
    </>
  )
}
