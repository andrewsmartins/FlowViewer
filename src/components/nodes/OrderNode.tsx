import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

const ORDER_LABELS: Record<string, string> = {
  generateOrder: 'Gerar pedido',
  addToCart:     'Adicionar ao carrinho',
}

/** action.type = order — pedido (gerar pedido / adicionar ao carrinho). */
export function OrderNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`) ?? ''
  const orderLabel = data.orderType ? (ORDER_LABELS[data.orderType] ?? data.orderType) : 'Pedido'

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-orange-800' : 'bg-white border-orange-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-orange-500' : '!bg-orange-400'} />

      <div className={`text-white px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-orange-600' : 'bg-orange-500'}`}>
        <OrderIcon />
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
        <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${isDark ? 'bg-orange-950 text-orange-300 border-orange-800' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
          {orderLabel}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className={isDark ? '!bg-orange-500' : '!bg-orange-400'} />
    </div>
  )
}

function OrderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}
