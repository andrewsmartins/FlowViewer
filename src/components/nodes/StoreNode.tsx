import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

/** action.type = store — ações sobre a loja física. */
export function StoreNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`) ?? ''

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-lime-800' : 'bg-white border-lime-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-lime-500' : '!bg-lime-400'} />

      <div className={`text-white px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-lime-700' : 'bg-lime-600'}`}>
        <StoreIcon />
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
        <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${isDark ? 'bg-lime-950 text-lime-300 border-lime-800' : 'bg-lime-50 text-lime-700 border-lime-200'}`}>
          <span>Loja física</span>
          {data.storeType && <span className="font-semibold">{data.storeType}</span>}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className={isDark ? '!bg-lime-500' : '!bg-lime-400'} />
    </div>
  )
}

function StoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <path d="M3 9l1-5h16l1 5" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
    </svg>
  )
}
