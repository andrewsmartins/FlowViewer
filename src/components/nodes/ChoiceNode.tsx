import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

export function ChoiceNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`) ?? ''
  const isList  = data.actionType === 'list'

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-blue-800' : 'bg-white border-blue-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-blue-500' : '!bg-blue-400'} />

      <div className={`text-white px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-blue-600' : 'bg-blue-500'}`}>
        {isList ? <ListIcon /> : <ChoiceIcon />}
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

      {data.buttons.length > 0 && (
        <div className="px-3 pb-2 pt-1 flex flex-col gap-1">
          {data.buttons.slice(0, 4).map(btn => (
            <span
              key={btn.id}
              className={`text-[10px] border rounded-full px-2 py-0.5 truncate ${isDark ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
              title={btn.description ?? btn.text}
            >
              {btn.text}
            </span>
          ))}
          {data.buttons.length > 4 && (
            <span className={`text-[10px] pl-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              +{data.buttons.length - 4} opções
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={isDark ? '!bg-blue-500' : '!bg-blue-400'} />
    </div>
  )
}

function ChoiceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <rect x="3" y="5" width="18" height="4" rx="1" />
      <rect x="3" y="13" width="18" height="4" rx="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
