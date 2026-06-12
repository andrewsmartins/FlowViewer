import { Panel } from '@xyflow/react'
import { useTheme } from '../contexts/ThemeContext'

interface CanvasControlsProps {
  onSpacingIncrease: () => void
  onSpacingDecrease: () => void
}

/** Ajuste de espaçamento do layout automático (relayout — perde posições manuais). */
export function CanvasControls({ onSpacingIncrease, onSpacingDecrease }: CanvasControlsProps) {
  const isDark = useTheme()
  const panelBg  = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  const btnText  = isDark ? 'text-slate-300' : 'text-slate-600'
  const btnHover = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
  const spaceTxt = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <Panel position="top-center">
      <div className={`flex gap-1 items-center border rounded-lg shadow-sm p-1 ${panelBg}`}>
        <button
          onClick={onSpacingDecrease}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-base font-medium leading-none transition-colors ${btnText} ${btnHover}`}
          title="Diminuir espaçamento (refaz o layout)"
        >−</button>
        <span className={`text-xs select-none px-1 ${spaceTxt}`}>espaço</span>
        <button
          onClick={onSpacingIncrease}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-base font-medium leading-none transition-colors ${btnText} ${btnHover}`}
          title="Aumentar espaçamento (refaz o layout)"
        >+</button>
      </div>
    </Panel>
  )
}
