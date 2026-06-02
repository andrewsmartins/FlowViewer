import { Handle, Position } from '@xyflow/react'
import type { FlowNodeData } from '../../types'

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
  const preview = data.messagePreview?.replace(/@[\w.#]+/g, match => `[${match.slice(1)}]`) ?? ''
  const captureLabel = data.captureDataType
    ? (CAPTURE_LABELS[data.captureDataType] ?? data.captureDataType)
    : null

  return (
    <div className="bg-white border border-violet-200 rounded-xl shadow-sm w-[240px] overflow-hidden">
      <Handle type="target" position={Position.Top} className="!bg-violet-400" />

      <div className="bg-violet-500 text-white px-3 py-2">
        <p className="text-xs font-semibold leading-tight truncate">{data.name}</p>
        <p className="text-[10px] opacity-75 truncate">{data.category}</p>
      </div>

      {preview && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{preview}</p>
        </div>
      )}

      {captureLabel && (
        <div className="px-3 pb-2 pt-1">
          <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
            <span>Captura:</span>
            <span className="font-semibold">{captureLabel}</span>
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-violet-400" />
    </div>
  )
}
