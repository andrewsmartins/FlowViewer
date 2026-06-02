import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'

export function ChoiceNode({ data }: { data: FlowNodeData }) {
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, match => `[${match.slice(1)}]`) ?? ''

  return (
    <div className="bg-white border border-blue-200 rounded-xl shadow-sm w-[240px] overflow-hidden">
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />

      <div className="bg-blue-500 text-white px-3 py-2">
        <p className="text-xs font-semibold leading-tight truncate">{data.name}</p>
        <p className="text-[10px] opacity-75 truncate">{data.category}</p>
      </div>

      {preview && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{preview}</p>
        </div>
      )}

      {data.buttons.length > 0 && (
        <div className="px-3 pb-2 pt-1 flex flex-col gap-1">
          {data.buttons.map(btn => (
            <span
              key={btn.id}
              className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 truncate"
            >
              {btn.text}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </div>
  )
}
