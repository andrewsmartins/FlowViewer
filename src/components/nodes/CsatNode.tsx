import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

const CSAT_LABELS: Record<string, string> = {
  supportRate:        'Nota da avaliação',
  supportRateComment: 'Comentário da avaliação',
}

/** action.type = captureCsat — captura da pesquisa de satisfação (CSAT). */
export function CsatNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`) ?? ''
  const csatLabel = data.captureDataType ? (CSAT_LABELS[data.captureDataType] ?? data.captureDataType) : 'CSAT'

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-pink-800' : 'bg-white border-pink-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-pink-500' : '!bg-pink-400'} />

      <div className={`text-white px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-pink-600' : 'bg-pink-500'}`}>
        <CsatIcon />
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
        <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${isDark ? 'bg-pink-950 text-pink-300 border-pink-800' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
          {csatLabel}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className={isDark ? '!bg-pink-500' : '!bg-pink-400'} />
    </div>
  )
}

function CsatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
