import { useState, useEffect, useCallback } from 'react'
import type { Node } from '@xyflow/react'
import type { BotIntent, BulkUpdateItem, FlowNodeData, NodeKind } from '../types'
import { useTheme } from '../contexts/ThemeContext'
import {
  listMessages, updateMessageText, addTextMessage, removeMessage,
  updateButton, updateIntentMeta, updateActionFields, updateSetDataItems,
  type EditableMessage, type MessageRef,
} from '../utils/editIntent'

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

const TRANSFER_TYPES = [
  { value: 'direct4group',        label: 'Grupo direto' },
  { value: 'search4group',        label: 'Busca de grupo' },
  { value: 'direct4user',         label: 'Usuário direto' },
  { value: 'direct4userPrevious', label: 'Atendente anterior' },
  { value: 'direct4userCurrent',  label: 'Atendente atual' },
]

const CAPTURE_TYPES = [
  { value: 'free',    label: 'Livre' },
  { value: 'custom',  label: 'Customizado' },
  { value: 'name',    label: 'Nome' },
  { value: 'fullName', label: 'Nome completo' },
  { value: 'cpf',     label: 'CPF' },
  { value: 'email',   label: 'E-mail' },
  { value: 'phone',   label: 'Telefone' },
  { value: 'zipcode', label: 'CEP' },
  { value: 'entity',  label: 'Entidade' },
]

const COND_TYPE_LABELS: Record<string, string> = {
  exists: 'existe', else: 'senão', any: 'qualquer', equals: 'igual',
}

interface Draft {
  name: string
  category: string
  keywords: string
  messages: EditableMessage[]
  newMessages: string[]
  removedRefs: MessageRef[]
  buttons: { text: string; description: string }[]
  transferType: string
  transferValue: string
  captureDataType: string
  captureVariable: string
  setDataItems: BulkUpdateItem[]
}

function buildDraft(intent: BotIntent): Draft {
  const transferCond = intent.conditions.find(c => c.action.type === 'transfer')
  const captureCond  = intent.conditions.find(c => c.action.type === 'captureData')
  const setDataCond  = intent.conditions.find(c => c.action.type === 'setData')
  const buttons = intent.conditions
    .flatMap(c => c.assistant_says).flatMap(s => s.messages)
    .find(m => (m.type === 'BUTTON' || m.type === 'LIST') && m.messageConfig?.buttons?.length)
    ?.messageConfig?.buttons ?? []

  return {
    name: intent.name,
    category: intent.category,
    keywords: (intent.keywords ?? []).join(', '),
    messages: listMessages(intent),
    newMessages: [],
    removedRefs: [],
    buttons: buttons.map(b => ({ text: b.text, description: b.description ?? '' })),
    transferType: transferCond?.action.transferType ?? '',
    transferValue: transferCond?.action.value ?? '',
    captureDataType: captureCond?.action.captureDataType ?? '',
    captureVariable: captureCond?.action.variable ?? '',
    setDataItems: (Array.isArray(setDataCond?.action.bulkUpdate) ? setDataCond.action.bulkUpdate : [])
      .map(i => ({ ...i })),
  }
}

interface DetailPanelProps {
  node: Node<FlowNodeData>
  intent: BotIntent | null
  onApply: (intentId: string) => void
  onClose: () => void
}

export function DetailPanel({ node, intent, onApply, onClose }: DetailPanelProps) {
  const isDark = useTheme()
  const kind = (node.type ?? 'defaultNode') as NodeKind
  const badge = (isDark ? KIND_LABELS_DARK : KIND_LABELS_LIGHT)[kind]
  const [draft, setDraft] = useState<Draft | null>(intent ? buildDraft(intent) : null)
  const [panelError, setPanelError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(intent ? buildDraft(intent) : null)
    setPanelError(null)
  }, [node.id])

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(d => d ? { ...d, [key]: value } : d)
  }, [])

  /** Aplica o rascunho no modelo via patches pequenos; para no primeiro erro. */
  function handleApply() {
    if (!intent || !draft) return
    const results = [
      updateIntentMeta(intent, {
        name: draft.name,
        category: draft.category,
        keywords: draft.keywords.split(',').map(k => k.trim()).filter(Boolean),
      }),
      ...draft.messages.map(m => updateMessageText(intent, m.ref, m.text)),
      // remoções em ordem decrescente de índice para não deslocar as demais
      ...[...draft.removedRefs]
        .sort((a, b) => b.condIdx - a.condIdx || b.sayIdx - a.sayIdx || b.msgIdx - a.msgIdx)
        .map(ref => removeMessage(intent, ref)),
      ...draft.newMessages.filter(t => t.trim()).map(t => addTextMessage(intent, t.trim())),
      ...draft.buttons.map((b, i) => updateButton(intent, i, b.text, b.description || null)),
    ]
    if (kind === 'transferNode') {
      results.push(updateActionFields(intent, 'transfer', { transferType: draft.transferType, value: draft.transferValue }))
    }
    if (kind === 'captureNode') {
      results.push(updateActionFields(intent, 'captureData', { captureDataType: draft.captureDataType, variable: draft.captureVariable }))
    }
    if (kind === 'setDataNode') {
      results.push(updateSetDataItems(intent, draft.setDataItems))
    }
    const failed = results.find(r => !r.ok)
    if (failed && !failed.ok) {
      setPanelError(`Falha ao aplicar: ${failed.reason}.`)
      return
    }
    setPanelError(null)
    onApply(intent.id)
    setDraft(buildDraft(intent))
  }

  const inputCls = `w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none transition-colors ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-600 placeholder:text-slate-600'
      : 'bg-white border-slate-200 text-slate-700 focus:border-blue-400 placeholder:text-slate-300'
  }`
  const labelCls = `text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  const ghostBtnCls = `text-[10px] font-medium rounded px-1.5 py-0.5 transition-colors ${
    isDark ? 'text-slate-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'
  }`

  const editable = !!intent && !!draft

  return (
    <div className={`absolute right-0 top-0 h-full w-96 border-l shadow-xl z-10 flex flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`flex items-start justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
        <div className="min-w-0 pr-2">
          <p className={`text-sm font-semibold leading-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{node.data.name}</p>
          <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{node.data.category}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {!editable && (
          <ReadOnlyExternal node={node} isDark={isDark} />
        )}

        {editable && draft && (
          <>
            <Section title="Geral" isDark={isDark}>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Nome</span>
                  <input className={inputCls} value={draft.name} onChange={e => set('name', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Categoria</span>
                  <input className={inputCls} value={draft.category} onChange={e => set('category', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Keywords (separadas por vírgula)</span>
                  <input className={inputCls} value={draft.keywords} onChange={e => set('keywords', e.target.value)} placeholder="ex: oi, olá, menu" />
                </label>
              </div>
            </Section>

            <Section title="Mensagens" isDark={isDark}>
              <div className="flex flex-col gap-2">
                {draft.messages.map((msg, i) => (
                  <div key={`${msg.ref.condIdx}-${msg.ref.sayIdx}-${msg.ref.msgIdx}`} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className={labelCls}>{msg.type}</span>
                      {msg.type === 'TEXT' && (
                        <button
                          className={ghostBtnCls}
                          onClick={() => setDraft(d => d && ({
                            ...d,
                            messages: d.messages.filter((_, j) => j !== i),
                            removedRefs: [...d.removedRefs, msg.ref],
                          }))}
                        >remover</button>
                      )}
                    </div>
                    <textarea
                      className={`${inputCls} resize-y min-h-[56px]`}
                      value={msg.text}
                      onChange={e => setDraft(d => d && ({
                        ...d,
                        messages: d.messages.map((m, j) => j === i ? { ...m, text: e.target.value } : m),
                      }))}
                    />
                  </div>
                ))}
                {draft.newMessages.map((text, i) => (
                  <div key={`new-${i}`} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className={labelCls}>TEXT (nova)</span>
                      <button
                        className={ghostBtnCls}
                        onClick={() => set('newMessages', draft.newMessages.filter((_, j) => j !== i))}
                      >remover</button>
                    </div>
                    <textarea
                      className={`${inputCls} resize-y min-h-[56px]`}
                      value={text}
                      placeholder="Texto da mensagem…"
                      onChange={e => set('newMessages', draft.newMessages.map((t, j) => j === i ? e.target.value : t))}
                    />
                  </div>
                ))}
                <button
                  className={`text-xs font-medium rounded-lg border border-dashed px-2 py-1.5 transition-colors ${
                    isDark ? 'text-slate-400 border-slate-700 hover:bg-slate-800' : 'text-slate-500 border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => set('newMessages', [...draft.newMessages, ''])}
                >+ Adicionar mensagem de texto</button>
              </div>
            </Section>

            {draft.buttons.length > 0 && (
              <Section title="Opções (texto dos botões)" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  {draft.buttons.map((btn, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <input
                        className={inputCls}
                        value={btn.text}
                        onChange={e => set('buttons', draft.buttons.map((b, j) => j === i ? { ...b, text: e.target.value } : b))}
                      />
                      <input
                        className={inputCls}
                        value={btn.description}
                        placeholder="Descrição (opcional)"
                        onChange={e => set('buttons', draft.buttons.map((b, j) => j === i ? { ...b, description: e.target.value } : b))}
                      />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {kind === 'transferNode' && (
              <Section title="Transferência" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Tipo</span>
                    <select className={inputCls} value={draft.transferType} onChange={e => set('transferType', e.target.value)}>
                      {TRANSFER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      {!TRANSFER_TYPES.some(t => t.value === draft.transferType) && draft.transferType && (
                        <option value={draft.transferType}>{draft.transferType}</option>
                      )}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Destino (ID do grupo/usuário)</span>
                    <input className={`${inputCls} font-mono`} value={draft.transferValue} onChange={e => set('transferValue', e.target.value)} />
                  </label>
                </div>
              </Section>
            )}

            {kind === 'captureNode' && (
              <Section title="Captura de dado" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Tipo de dado</span>
                    <select className={inputCls} value={draft.captureDataType} onChange={e => set('captureDataType', e.target.value)}>
                      {CAPTURE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      {!CAPTURE_TYPES.some(t => t.value === draft.captureDataType) && draft.captureDataType && (
                        <option value={draft.captureDataType}>{draft.captureDataType}</option>
                      )}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Variável de destino</span>
                    <input className={`${inputCls} font-mono`} value={draft.captureVariable} onChange={e => set('captureVariable', e.target.value)} placeholder="ex: customer.name" />
                  </label>
                </div>
              </Section>
            )}

            {kind === 'setDataNode' && (
              <Section title="Variáveis definidas" isDark={isDark}>
                <div className="flex flex-col gap-1.5">
                  {draft.setDataItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        className={`${inputCls} font-mono flex-1`}
                        value={item.variable}
                        placeholder="variável"
                        onChange={e => set('setDataItems', draft.setDataItems.map((it, j) => j === i ? { ...it, variable: e.target.value } : it))}
                      />
                      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>=</span>
                      <input
                        className={`${inputCls} flex-1`}
                        value={item.value}
                        placeholder="valor"
                        onChange={e => set('setDataItems', draft.setDataItems.map((it, j) => j === i ? { ...it, value: e.target.value } : it))}
                      />
                      <button className={ghostBtnCls} onClick={() => set('setDataItems', draft.setDataItems.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                  <button
                    className={`text-xs font-medium rounded-lg border border-dashed px-2 py-1.5 transition-colors ${
                      isDark ? 'text-slate-400 border-slate-700 hover:bg-slate-800' : 'text-slate-500 border-slate-300 hover:bg-slate-50'
                    }`}
                    onClick={() => set('setDataItems', [...draft.setDataItems, { variable: '', value: '' }])}
                  >+ Adicionar variável</button>
                </div>
              </Section>
            )}

            {node.data.conditions.length > 0 && (
              <Section title="Condições (somente leitura)" isDark={isDark}>
                <div className="flex flex-col gap-1.5">
                  {node.data.conditions.map((cond, i) => (
                    <div key={i} className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {cond.name}
                        <span className={`ml-1.5 text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {COND_TYPE_LABELS[cond.type] ?? cond.type}
                        </span>
                      </p>
                      {cond.variable && (
                        <p className={`text-[10px] font-mono mt-1 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cond.variable}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {editable && (
        <div className={`px-4 py-3 border-t flex flex-col gap-2 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          {panelError && (
            <p className={`text-[11px] leading-snug ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{panelError}</p>
          )}
          <button
            onClick={handleApply}
            className="w-full text-xs font-semibold rounded-lg px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >Aplicar alterações</button>
        </div>
      )}
    </div>
  )
}

function ReadOnlyExternal({ node, isDark }: { node: Node<FlowNodeData>; isDark: boolean }) {
  return (
    <Section title="Destino externo (somente leitura)" isDark={isDark}>
      <InfoRow label="Bot ID"    value={node.data.externalBotId    ?? '-'} isDark={isDark} />
      <InfoRow label="Intent ID" value={node.data.externalIntentId ?? '-'} isDark={isDark} />
    </Section>
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

function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 mb-1.5">
      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-[10px] break-all border rounded px-1.5 py-0.5 font-mono ${isDark ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-800 border-amber-200'}`} title={value}>
        {value}
      </span>
    </div>
  )
}
