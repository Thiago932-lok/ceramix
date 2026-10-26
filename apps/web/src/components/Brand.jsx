export function BrandMark({ size = 40 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <rect x="2" y="2" width="28" height="28" rx="9" />
        <path d="M8 11.2h7v5H8zM17.3 11.2H24v5h-6.7zM8 18.2h9.2v5H8zM19.5 18.2H24v5h-4.5z" />
      </svg>
    </span>
  )
}

export function BrandLockup({ subtitulo = 'Produção & Expedição' }) {
  return (
    <div className="brand-lockup">
      <BrandMark />
      <div>
        <p className="brand-name">Ceramix</p>
        <p className="brand-sub">{subtitulo}</p>
      </div>
    </div>
  )
}
