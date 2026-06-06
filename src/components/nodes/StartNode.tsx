import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

export function StartNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  return (
    <div className={`flex items-center justify-center text-white rounded-full px-6 py-3 shadow-md border-2 min-w-[140px] ${isDark ? 'bg-emerald-600 border-emerald-700' : 'bg-emerald-500 border-emerald-600'}`}>
      <span className="text-sm font-bold tracking-wide uppercase">
        {data.name}
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-700" />
    </div>
  )
}
