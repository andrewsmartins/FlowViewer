import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

/** action.type = external — chamada de API externa (≠ redirecionamento a outro bot). */
export function ApiCallNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`) ?? ''

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-teal-800' : 'bg-white border-teal-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-teal-500' : '!bg-teal-400'} />

      <div className={`text-white px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-teal-700' : 'bg-teal-600'}`}>
        <ApiIcon />
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
        <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${isDark ? 'bg-teal-950 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
          <span>Chamada API</span>
          {data.apiName && <span className="font-semibold font-mono truncate max-w-[120px]">{data.apiName}</span>}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className={isDark ? '!bg-teal-500' : '!bg-teal-400'} />
    </div>
  )
}

function ApiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}
