import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

/** Nó terminal: action.type = endConversation (Terminar conversa). Sem saída. */
export function EndNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`) ?? ''

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-red-800' : 'bg-white border-red-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-red-500' : '!bg-red-400'} />

      <div className={`text-white px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-red-700' : 'bg-red-600'}`}>
        <EndIcon />
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight truncate">{data.name}</p>
          <p className="text-[10px] opacity-75 truncate">{data.category}</p>
        </div>
      </div>

      {preview && (
        <div className="px-3 pt-2 pb-1">
          <p className={`text-xs leading-relaxed line-clamp-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{preview}</p>
        </div>
      )}

      <div className="px-3 pb-2 pt-1">
        <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${isDark ? 'bg-red-950 text-red-300 border-red-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
          Encerra a conversa
        </span>
      </div>
    </div>
  )
}

function EndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}
