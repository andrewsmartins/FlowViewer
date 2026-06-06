import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

const CAPTURE_LABELS: Record<string, string> = {
  name: 'Nome',
  fullName: 'Nome completo',
  zipcode: 'CEP',
  addressNumber: 'Número do endereço',
  addressComplement: 'Complemento',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
}

export function CaptureNode({ data }: { data: FlowNodeData }) {
  const isDark = useTheme()
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, match => `[${match.slice(1)}]`) ?? ''
  const captureLabel = data.captureDataType
    ? (CAPTURE_LABELS[data.captureDataType] ?? data.captureDataType)
    : null

  return (
    <div className={`border rounded-xl shadow-sm w-[240px] overflow-hidden ${isDark ? 'bg-slate-800 border-violet-800' : 'bg-white border-violet-200'}`}>
      <Handle type="target" position={Position.Top} className={isDark ? '!bg-violet-500' : '!bg-violet-400'} />

      <div className={`text-white px-3 py-2 ${isDark ? 'bg-violet-600' : 'bg-violet-500'}`}>
        <p className="text-xs font-semibold leading-tight truncate">{data.name}</p>
        <p className="text-[10px] opacity-75 truncate">{data.category}</p>
      </div>

      {preview && (
        <div className="px-3 pt-2 pb-1">
          <p className={`text-xs leading-relaxed line-clamp-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{preview}</p>
        </div>
      )}

      {captureLabel && (
        <div className="px-3 pb-2 pt-1">
          <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ${isDark ? 'bg-violet-950 text-violet-300 border-violet-800' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
            <span>Captura:</span>
            <span className="font-semibold">{captureLabel}</span>
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={isDark ? '!bg-violet-500' : '!bg-violet-400'} />
    </div>
  )
}
