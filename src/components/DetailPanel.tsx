import type { Node } from '@xyflow/react'
import type { FlowNodeData, NodeKind } from '../types'
import { useTheme } from '../contexts/ThemeContext'

const KIND_LABELS_LIGHT: Record<NodeKind, { label: string; color: string }> = {
  startNode:       { label: 'Início',          color: 'bg-emerald-100 text-emerald-700' },
  choiceNode:      { label: 'Escolha',          color: 'bg-blue-100 text-blue-700' },
  captureNode:     { label: 'Captura',          color: 'bg-violet-100 text-violet-700' },
  transferNode:    { label: 'Transferência',    color: 'bg-rose-100 text-rose-700' },
  waitNode:        { label: 'Aguarda',          color: 'bg-cyan-100 text-cyan-700' },
  setDataNode:     { label: 'Variável',         color: 'bg-indigo-100 text-indigo-700' },
  externalBotNode: { label: 'Outro Bot',        color: 'bg-amber-100 text-amber-700' },
  defaultNode:     { label: 'Padrão',           color: 'bg-slate-100 text-slate-600' },
}

const KIND_LABELS_DARK: Record<NodeKind, { label: string; color: string }> = {
  startNode:       { label: 'Início',          color: 'bg-emerald-950 text-emerald-300' },
  choiceNode:      { label: 'Escolha',          color: 'bg-blue-950 text-blue-300' },
  captureNode:     { label: 'Captura',          color: 'bg-violet-950 text-violet-300' },
  transferNode:    { label: 'Transferência',    color: 'bg-rose-950 text-rose-300' },
  waitNode:        { label: 'Aguarda',          color: 'bg-cyan-950 text-cyan-300' },
  setDataNode:     { label: 'Variável',         color: 'bg-indigo-950 text-indigo-300' },
  externalBotNode: { label: 'Outro Bot',        color: 'bg-amber-950 text-amber-300' },
  defaultNode:     { label: 'Padrão',           color: 'bg-slate-800 text-slate-400' },
}

const CAPTURE_LABELS: Record<string, string> = {
  name: 'Nome', fullName: 'Nome completo', zipcode: 'CEP',
  addressNumber: 'Número do endereço', addressComplement: 'Complemento',
  email: 'E-mail', phone: 'Telefone', cpf: 'CPF',
}

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  direct4group:        'Grupo direto',
  direct4user:         'Usuário direto',
  direct4userPrevious: 'Atendente anterior',
  direct4userCurrent:  'Atendente atual',
  queue:               'Fila de atendimento',
}

const COND_TYPE_STYLES_LIGHT: Record<string, string> = {
  exists: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  else:   'bg-slate-50 text-slate-500 border-slate-200',
  any:    'bg-blue-50 text-blue-600 border-blue-200',
  equals: 'bg-orange-50 text-orange-700 border-orange-200',
}

const COND_TYPE_STYLES_DARK: Record<string, string> = {
  exists: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  else:   'bg-slate-800 text-slate-400 border-slate-700',
  any:    'bg-blue-950 text-blue-300 border-blue-800',
  equals: 'bg-orange-950 text-orange-300 border-orange-800',
}

const COND_TYPE_LABELS: Record<string, string> = {
  exists: 'existe',
  else:   'senão',
  any:    'qualquer',
  equals: 'igual',
}

interface DetailPanelProps {
  node: Node<FlowNodeData>
  onClose: () => void
}

export function DetailPanel({ node, onClose }: DetailPanelProps) {
  const isDark = useTheme()
  const data = node.data
  const kind = (node.type ?? 'defaultNode') as NodeKind
  const KIND_LABELS = isDark ? KIND_LABELS_DARK : KIND_LABELS_LIGHT
  const COND_TYPE_STYLES = isDark ? COND_TYPE_STYLES_DARK : COND_TYPE_STYLES_LIGHT
  const badge = KIND_LABELS[kind] ?? KIND_LABELS.defaultNode

  return (
    <div className={`absolute right-0 top-0 h-full w-80 border-l shadow-xl z-10 flex flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`flex items-start justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
        <div className="min-w-0 pr-2">
          <p className={`text-sm font-semibold leading-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{data.name}</p>
          <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{data.category}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
          <button
            onClick={onClose}
            className={`transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* Keywords */}
        {data.keywords.length > 0 && (
          <Section title="Keywords" isDark={isDark}>
            <div className="flex flex-wrap gap-1">
              {data.keywords.map(kw => (
                <span key={kw} className={`text-[10px] rounded-full px-2 py-0.5 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                  {kw}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Messages */}
        {data.allMessages.length > 0 && (
          <Section title="Mensagens" isDark={isDark}>
            <div className="flex flex-col gap-2">
              {data.allMessages.map((msg, i) => (
                <p
                  key={i}
                  className={`text-xs leading-relaxed rounded-lg px-3 py-2 border whitespace-pre-wrap ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-600 bg-slate-50 border-slate-100'}`}
                >
                  {msg.replace(/@[\w.#]+/g, m => `[${m.slice(1)}]`)}
                </p>
              ))}
            </div>
          </Section>
        )}

        {/* Buttons / list options */}
        {data.buttons.length > 0 && (
          <Section title="Opções" isDark={isDark}>
            <div className="flex flex-col gap-1.5">
              {data.buttons.map(btn => (
                <div key={btn.id} className={`border rounded-lg px-3 py-1.5 ${isDark ? 'bg-blue-950 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-xs font-medium ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>{btn.text}</p>
                  {btn.description && (
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{btn.description}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Capture type */}
        {data.captureDataType && (
          <Section title="Dado capturado" isDark={isDark}>
            <span className={`text-xs border rounded-full px-2 py-0.5 ${isDark ? 'text-violet-300 bg-violet-950 border-violet-800' : 'text-violet-700 bg-violet-50 border-violet-200'}`}>
              {CAPTURE_LABELS[data.captureDataType] ?? data.captureDataType}
            </span>
          </Section>
        )}

        {/* Transfer info */}
        {(data.transferType || data.transferValue) && (
          <Section title="Transferência" isDark={isDark}>
            <div className="flex flex-col gap-1.5">
              {data.transferType && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tipo</span>
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${isDark ? 'text-rose-300 bg-rose-950 border-rose-800' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                    {TRANSFER_TYPE_LABELS[data.transferType] ?? data.transferType}
                  </span>
                </div>
              )}
              {data.transferValue && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Destino</span>
                  <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${isDark ? 'text-rose-300 bg-rose-950 border-rose-800' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                    {data.transferValue}
                  </span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Conditions */}
        {data.conditions.length > 0 && (
          <Section title="Condições" isDark={isDark}>
            <div className="flex flex-col gap-1.5">
              {data.conditions.map((cond, i) => {
                const typeStyle = COND_TYPE_STYLES[cond.type] ?? COND_TYPE_STYLES.any
                const typeLabel = COND_TYPE_LABELS[cond.type] ?? cond.type
                return (
                  <div key={i} className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{cond.name}</p>
                      <span className={`text-[10px] border rounded-full px-1.5 py-0 ${typeStyle}`}>
                        {typeLabel}
                      </span>
                    </div>
                    {cond.variable && (
                      <p className={`text-[10px] font-mono mt-1 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title={cond.variable}>
                        {cond.variable}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* External bot info */}
        {kind === 'externalBotNode' && (
          <Section title="Destino externo" isDark={isDark}>
            <InfoRow label="Bot ID"    value={data.externalBotId    ?? '-'} mono isDark={isDark} />
            <InfoRow label="Intent ID" value={data.externalIntentId ?? '-'} mono isDark={isDark} />
          </Section>
        )}

        {/* SetData items */}
        {data.setDataItems.length > 0 && (
          <Section title="Variáveis definidas" isDark={isDark}>
            <div className="flex flex-col gap-1.5">
              {data.setDataItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className={`font-mono border rounded px-1.5 py-0.5 text-[10px] ${isDark ? 'text-indigo-300 bg-indigo-950 border-indigo-800' : 'text-indigo-600 bg-indigo-50 border-indigo-200'}`}>
                    {item.variable}
                  </span>
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>=</span>
                  <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono, isDark }: { label: string; value: string; mono?: boolean; isDark: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 mb-1.5">
      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
      <span
        className={`text-[10px] break-all border rounded px-1.5 py-0.5 ${mono ? 'font-mono' : ''} ${isDark ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-800 border-amber-200'}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
