const paths = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V9l6 3.5V9l6 3.5V6h6v15z" />
      <path d="M7 17h1M12 17h1M17 17h1" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6.5h10v9h-10z" />
      <path d="M12.5 10h4l3 3v2.5h-7z" />
      <circle cx="6.5" cy="18" r="1.7" />
      <circle cx="16.5" cy="18" r="1.7" />
    </>
  ),
  package: (
    <>
      <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4M12.5 16V7M17 16v-6" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 15.2c2 .6 3.5 2.2 3.5 4.8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 9v5M12 17.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-left': <path d="M20 12H5M11 6l-6 6 6 6" />,
  download: (
    <>
      <path d="M12 3v12M7.5 11 12 15.5 16.5 11" />
      <path d="M4 20h16" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.7L4 8" />
      <path d="M4 4v4h4M4 13a8 8 0 0 0 14.3 4.7L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  wifi: (
    <>
      <path d="M3.5 9a13 13 0 0 1 17 0M6.5 12.5a8.5 8.5 0 0 1 11 0M9.5 16a4 4 0 0 1 5 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 12.5a8.5 8.5 0 0 1 4-2.2M15.5 11.5a8.5 8.5 0 0 1 2 1" />
      <path d="M5 9a13 13 0 0 1 3.5-2M12 7c2.7 0 5.2 1 7 2.5" />
      <path d="M9.5 16a4 4 0 0 1 5 0M12 19.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a15.5 15.5 0 0 1-2.4 3.2M6.5 7.3A15.9 15.9 0 0 0 2.5 12S6 18 12 18c1.4 0 2.7-.3 3.8-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'map-pin': (
    <>
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M5 8h14" />
      <path d="M8 8 4.5 14h7zM16 8l-3.5 6h7z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 7.5 12 12l9-4.5z" />
      <path d="m3 12.5 9 4.5 9-4.5M3 17l9 4.5 9-4.5" />
    </>
  ),
  'file-text': (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  'rotate-ccw': (
    <>
      <path d="M4 5v5h5" />
      <path d="M4.6 14a8 8 0 1 0 1.8-8.3L4 8" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 1 0-6.4-6.4L11.5 6" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 1 0 6.4 6.4l1.5-1.5" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 9h4a1 1 0 0 1 1 1v11M2.5 21h19" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
      <path d="M5.5 5.5h13l2.5 7.5v5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-5z" />
    </>
  ),
  filter: <path d="M4 6h16l-6.5 7.5V20l-3-1.8v-4.7z" />,
  'trending-up': (
    <>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M15 8h5v5" />
    </>
  ),
  'trending-down': (
    <>
      <path d="M3 7l6 6 4-4 7 7" />
      <path d="M15 16h5v-5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M17 17l2-2M14 14l1.5-1.5" />
    </>
  ),
  'shield-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 1.2-.6 2.3-1.3 3.2-2.2M19 12V6l-4.2-1.8" />
    </>
  )
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.8, ...rest }) {
  const conteudo = paths[name]
  if (!conteudo) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {conteudo}
    </svg>
  )
}
