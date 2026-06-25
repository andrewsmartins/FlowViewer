interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
  expanded?: boolean
}

export function ThemeToggle({ isDark, onToggle, expanded }: ThemeToggleProps) {
  const label = isDark ? 'Modo claro' : 'Modo escuro'
  return (
    <button
      onClick={onToggle}
      className={`flex items-center h-10 rounded-xl transition-colors ${
        expanded ? 'w-full justify-start px-3 gap-3' : 'w-10 justify-center'
      } ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={expanded ? undefined : label}
    >
      <span className="shrink-0">{isDark ? <SunIcon /> : <MoonIcon />}</span>
      {expanded && <span className="text-xs font-medium truncate">{label}</span>}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
