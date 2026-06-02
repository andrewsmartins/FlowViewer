import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'

export function StartNode({ data }: { data: FlowNodeData }) {
  return (
    <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full px-6 py-3 shadow-md border-2 border-emerald-600 min-w-[140px]">
      <span className="text-sm font-bold tracking-wide uppercase">
        {data.name}
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-700" />
    </div>
  )
}
