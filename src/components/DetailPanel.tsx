import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent } from 'react'
import type { Node } from '@xyflow/react'
import type { BotIntent, BulkUpdateItem, FlowNodeData, NodeKind } from '../types'
import { useTheme } from '../contexts/ThemeContext'
import { PRIORITY_LABELS, CONDITION_TYPE_LABELS } from '../utils/nodeMeta'
import {
  listMessages, updateMessageText, addTextMessage, removeMessage,
  updateButton, addButton, removeButton, addButtonsMessage,
  updateCondition, addCondition, removeCondition,
  updateIntentMeta, updateActionFields, updateSetDataItems, sanitizeIntentName,
  type EditableMessage, type MessageRef,
} from '../utils/editIntent'
import { VARIABLE_GROUPS, variableDisplay, type VariableItem } from '../utils/variables'
import type { VariableGroup } from '../utils/variables'
import type { EditResult } from '../utils/editFlow'
import { CREATABLE_KINDS, CREATABLE_KIND_LABELS, type CreatableKind } from '../utils/intentTemplates'

const KIND_LABELS_LIGHT: Record<NodeKind, { label: string; color: string }> = {
  startNode:       { label: 'Início',          color: 'bg-emerald-100 text-emerald-700' },
  choiceNode:      { label: 'Escolha',          color: 'bg-blue-100 text-blue-700' },
  captureNode:     { label: 'Captura',          color: 'bg-violet-100 text-violet-700' },
  transferNode:    { label: 'Transferência',    color: 'bg-rose-100 text-rose-700' },
  waitNode:        { label: 'Aguarda',          color: 'bg-cyan-100 text-cyan-700' },
  setDataNode:     { label: 'Variável',         color: 'bg-indigo-100 text-indigo-700' },
  externalBotNode: { label: 'Outro Bot',        color: 'bg-amber-100 text-amber-700' },
  defaultNode:     { label: 'Mensagem',         color: 'bg-slate-100 text-slate-600' },
  endNode:         { label: 'Terminar',         color: 'bg-red-100 text-red-700' },
  apiCallNode:     { label: 'Chamada API',      color: 'bg-teal-100 text-teal-700' },
  orderNode:       { label: 'Pedido',           color: 'bg-orange-100 text-orange-700' },
  csatNode:        { label: 'CSAT',             color: 'bg-pink-100 text-pink-700' },
  storeNode:       { label: 'Loja física',      color: 'bg-lime-100 text-lime-700' },
  intentGroupNode: { label: 'Intenção',         color: 'bg-slate-100 text-slate-600' },
}

const KIND_LABELS_DARK: Record<NodeKind, { label: string; color: string }> = {
  startNode:       { label: 'Início',          color: 'bg-emerald-950 text-emerald-300' },
  choiceNode:      { label: 'Escolha',          color: 'bg-blue-950 text-blue-300' },
  captureNode:     { label: 'Captura',          color: 'bg-violet-950 text-violet-300' },
  transferNode:    { label: 'Transferência',    color: 'bg-rose-950 text-rose-300' },
  waitNode:        { label: 'Aguarda',          color: 'bg-cyan-950 text-cyan-300' },
  setDataNode:     { label: 'Variável',         color: 'bg-indigo-950 text-indigo-300' },
  externalBotNode: { label: 'Outro Bot',        color: 'bg-amber-950 text-amber-300' },
  defaultNode:     { label: 'Mensagem',         color: 'bg-slate-800 text-slate-400' },
  endNode:         { label: 'Terminar',         color: 'bg-red-950 text-red-300' },
  apiCallNode:     { label: 'Chamada API',      color: 'bg-teal-950 text-teal-300' },
  orderNode:       { label: 'Pedido',           color: 'bg-orange-950 text-orange-300' },
  csatNode:        { label: 'CSAT',             color: 'bg-pink-950 text-pink-300' },
  storeNode:       { label: 'Loja física',      color: 'bg-lime-950 text-lime-300' },
  intentGroupNode: { label: 'Intenção',         color: 'bg-slate-800 text-slate-400' },
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

/** Opções de gatilho (ConditionType) — os 10 tipos oficiais da plataforma. */
const COND_TYPE_OPTIONS = Object.entries(CONDITION_TYPE_LABELS).map(([value, label]) => ({ value, label }))

/** Modo do painel: a forma de edição depende do nó clicado (Modelo B, Marco C). */
type PanelMode = 'group' | 'condition' | 'solo' | 'externalRO' | 'startRO'

/** Determina o modo e (para filhos) o índice da condição a partir do nó. */
function resolveMode(node: Node<FlowNodeData>, intent: BotIntent | null): { mode: PanelMode; condIdx: number } {
  if (node.type === 'externalBotNode' || !intent) return { mode: 'externalRO', condIdx: 0 }
  // O nó de início é somente-leitura: a estrutura da intenção `start` é canônica
  // e não deve ser editada (a conexão de saída é feita no canvas).
  if (node.type === 'startNode' || intent.category === 'start') return { mode: 'startRO', condIdx: 0 }
  if (node.type === 'intentGroupNode') return { mode: 'group', condIdx: 0 }
  const m = /::c(\d+)$/.exec(node.id)
  if (m) return { mode: 'condition', condIdx: Number(m[1]) }
  return { mode: 'solo', condIdx: 0 }
}

interface DraftCondition {
  name: string
  type: string
  variable: string
  value: string
  /** Tipo "context"/"lastIntent": IDs de intenções existentes. */
  intent: string
  context: string
  /** Índice em intent.conditions; null = condição nova ainda não aplicada. */
  originalIdx: number | null
  /** Tipo da AÇÃO da condição nova (só para `originalIdx === null`). */
  kind?: CreatableKind
}

/** Opções do select de tipo de ação ao adicionar uma condição nova. */
const KIND_OPTIONS = CREATABLE_KINDS.map(k => ({ value: k, label: CREATABLE_KIND_LABELS[k] }))

interface Draft {
  // Meta da intenção (modos group/solo)
  name: string
  category: string
  keywords: string
  priority: number
  context: string
  // Gatilho da condição editada (modo condition)
  condName: string
  condType: string
  condVariable: string
  condValue: string
  // Tipo "context" ("Contexto é igual a"): IDs de intenções existentes.
  condIntent: string
  condContext: string
  // Conteúdo (mensagens/botões/ação) do escopo editado (modos condition/solo)
  messages: EditableMessage[]
  newMessages: string[]
  removedRefs: MessageRef[]
  buttons: { text: string; description: string; originalIdx: number | null }[]
  removedButtonIdxs: number[]
  newButtonsBody: string | null
  transferType: string
  transferValue: string
  captureDataType: string
  captureVariable: string
  setDataItems: BulkUpdateItem[]
  // Lista de condições (modos group/solo) — estrutura da intenção
  conditions: DraftCondition[]
  removedCondIdxs: number[]
}

/** Botões (BUTTON/LIST) de UMA condição específica. */
function buttonsOfCondition(intent: BotIntent, condIdx: number) {
  return intent.conditions[condIdx]?.assistant_says
    .flatMap(s => s.messages)
    .find(m => (m.type === 'BUTTON' || m.type === 'LIST') && m.messageConfig?.buttons?.length)
    ?.messageConfig?.buttons ?? []
}

/** Botões da intenção inteira (1ª mensagem de botões encontrada) — modo solo. */
function buttonsOfIntent(intent: BotIntent) {
  return intent.conditions
    .flatMap(c => c.assistant_says).flatMap(s => s.messages)
    .find(m => (m.type === 'BUTTON' || m.type === 'LIST') && m.messageConfig?.buttons?.length)
    ?.messageConfig?.buttons ?? []
}

function hasButtonsMessage(intent: BotIntent, condIdx: number, mode: PanelMode): boolean {
  const conds = mode === 'condition' ? [intent.conditions[condIdx]].filter(Boolean) : intent.conditions
  return conds.some(c =>
    c.assistant_says.some(s => s.messages.some(m => (m.type === 'BUTTON' || m.type === 'LIST') && m.messageConfig)))
}

function buildDraft(intent: BotIntent, mode: PanelMode, condIdx: number): Draft {
  const scopedCond = intent.conditions[condIdx]
  const allMessages = listMessages(intent)
  const messages = mode === 'condition' ? allMessages.filter(m => m.ref.condIdx === condIdx) : allMessages

  // Condição-fonte de cada ação: no modo condition é a própria; no solo, a 1ª do tipo.
  const transferCond = mode === 'condition'
    ? (scopedCond?.action.type === 'transfer' ? scopedCond : undefined)
    : intent.conditions.find(c => c.action.type === 'transfer')
  const captureCond = mode === 'condition'
    ? (scopedCond?.action.type === 'captureData' ? scopedCond : undefined)
    : intent.conditions.find(c => c.action.type === 'captureData')
  const setDataCond = mode === 'condition'
    ? (scopedCond?.action.type === 'setData' ? scopedCond : undefined)
    : intent.conditions.find(c => c.action.type === 'setData')

  const buttons = mode === 'condition' ? buttonsOfCondition(intent, condIdx) : buttonsOfIntent(intent)

  return {
    name: intent.name,
    category: intent.category?.trim() || 'Sem Categoria',
    keywords: (intent.keywords ?? []).join(', '),
    priority: typeof intent.priority === 'number' ? intent.priority : 0,
    context: intent.context ?? '',
    condName: scopedCond?.name ?? '',
    condType: scopedCond?.type ?? 'any',
    condVariable: scopedCond?.variable ?? '',
    condValue: scopedCond?.value ?? '',
    condIntent: scopedCond?.intent ?? '',
    condContext: typeof scopedCond?.context === 'string' ? scopedCond.context : '',
    messages,
    newMessages: [],
    removedRefs: [],
    buttons: buttons.map((b, i) => ({ text: b.text, description: b.description ?? '', originalIdx: i })),
    removedButtonIdxs: [],
    newButtonsBody: null,
    transferType: transferCond?.action.transferType ?? '',
    transferValue: transferCond?.action.value ?? '',
    captureDataType: captureCond?.action.captureDataType ?? '',
    captureVariable: captureCond?.action.variable ?? '',
    setDataItems: (Array.isArray(setDataCond?.action.bulkUpdate) ? setDataCond.action.bulkUpdate : [])
      .map(i => ({ ...i })),
    conditions: intent.conditions.map((c, i) => ({
      name: c.name, type: c.type, variable: c.variable ?? '', value: c.value ?? '',
      intent: c.intent ?? '', context: typeof c.context === 'string' ? c.context : '', originalIdx: i,
    })),
    removedCondIdxs: [],
  }
}

interface KeywordTagsProps {
  /** Palavras-chave como string separada por vírgula (formato do draft/submit). */
  value: string
  onChange: (value: string) => void
  isDark: boolean
}

/**
 * Editor de palavras-chave como tags/chips. Mantém o valor como string separada
 * por vírgula (compatível com o submit em updateIntentMeta), mas exibe cada termo
 * como um chip removível. Enter ou vírgula confirma o termo digitado; Backspace
 * no campo vazio remove o último; blur confirma o pendente (evita perder texto
 * que o usuário digitou mas não deu Enter). Ignora duplicatas.
 */
function KeywordTags({ value, onChange, isDark }: KeywordTagsProps) {
  const [text, setText] = useState('')
  const tags = value.split(',').map(k => k.trim()).filter(Boolean)

  const commit = (raw: string) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
    setText('')
    if (!parts.length) return
    const next = [...tags]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    onChange(next.join(', '))
  }
  const removeAt = (idx: number) => onChange(tags.filter((_, i) => i !== idx).join(', '))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(text)
    } else if (e.key === 'Backspace' && !text && tags.length) {
      e.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  const boxCls = `w-full flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors ${
    isDark ? 'bg-slate-800 border-slate-700 focus-within:border-blue-600' : 'bg-white border-slate-200 focus-within:border-blue-400'
  }`
  const chipCls = `inline-flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5 ${
    isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
  }`
  const xCls = isDark ? 'leading-none text-slate-400 hover:text-rose-400' : 'leading-none text-slate-400 hover:text-rose-600'
  const fieldCls = `flex-1 min-w-[80px] text-xs bg-transparent outline-none ${
    isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-300'
  }`

  return (
    <div className={boxCls}>
      {tags.map((tag, i) => (
        <span key={`${tag}-${i}`} className={chipCls}>
          {tag}
          <button type="button" onClick={() => removeAt(i)} className={xCls} aria-label={`Remover ${tag}`}>×</button>
        </span>
      ))}
      <input
        className={fieldCls}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(text)}
        placeholder={tags.length ? '' : 'ex: oi, olá, menu'}
      />
    </div>
  )
}

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  /** Categorias conhecidas (já com "Sem Categoria" em primeiro). */
  options: string[]
  isDark: boolean
  inputCls: string
}

/**
 * Combobox de categoria: exibe o valor atual, abre a lista de categorias
 * conhecidas ao focar/clicar e permite digitar uma nova (que é criada ao salvar).
 * Substitui o <datalist> nativo, que não abre de forma confiável no clique nem
 * mostra sugestões quando o campo já tem um valor que casa com uma opção.
 */
function CategorySelect({ value, onChange, options, isDark, inputCls }: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora do componente.
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      // `Node` aqui seria o tipo do @xyflow/react (importado no topo); o alvo do
      // evento é um nó do DOM, então casamos via HTMLElement.
      if (wrapRef.current && !wrapRef.current.contains(e.target as unknown as HTMLElement)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  // Enquanto o usuário digita algo que ainda não é uma categoria exata, filtra;
  // se o valor casa com uma opção (ex.: logo após selecionar), mostra a lista toda.
  const query = value.trim().toLowerCase()
  const exactMatch = options.some(o => o.toLowerCase() === query)
  const filtered = query && !exactMatch
    ? options.filter(o => o.toLowerCase().includes(query))
    : options

  const pick = (opt: string) => {
    onChange(opt)
    setOpen(false)
  }

  const menuCls = `absolute z-30 mt-1 max-h-44 w-full overflow-auto rounded-lg border py-1 shadow-lg ${
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  }`
  const optionCls = (active: boolean) => `w-full text-left text-xs px-2.5 py-1.5 transition-colors ${
    active
      ? (isDark ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-800')
      : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')
  }`

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={inputCls}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setOpen(false) }}
        placeholder="Sem Categoria"
      />
      {open && filtered.length > 0 && (
        <ul className={menuCls}>
          {filtered.map(opt => (
            <li key={opt}>
              <button type="button" className={optionCls(opt === value)} onClick={() => pick(opt)}>{opt}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface VariablePickerProps {
  value: string
  onChange: (value: string) => void
  isDark: boolean
  inputCls: string
}

/**
 * Picker de variável em até 3 níveis: ao clicar/digitar `@`, abre a lista de
 * categorias (Consumidor, Canal, …); escolhendo a categoria, abre ao lado os itens
 * com rótulos legíveis; itens com mais de uma combinação abrem uma 3ª coluna de
 * MODIFICADORES (etapa final). O campo EXIBE o rótulo amigável ("Consumidor ›
 * Nome"), mas GRAVA a variável crua. Itens/categorias com `prefix` inserem o
 * prefixo e liberam digitação para completar à mão.
 */
function VariablePicker({ value, onChange, isDark, inputCls }: VariablePickerProps) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<VariableItem | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as unknown as HTMLElement)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const { label, resolved } = variableDisplay(value)
  const group = VARIABLE_GROUPS.find(g => g.key === activeGroup) ?? null

  const openPicker = () => { setActiveGroup(null); setActiveItem(null); setOpen(true) }

  /** Grava o valor cru; se for prefixo, foca o input para o usuário completar. */
  const commit = (raw: string, isPrefix?: boolean) => {
    onChange(raw)
    setOpen(false)
    if (isPrefix) requestAnimationFrame(() => inputRef.current?.focus())
  }

  const onCategoryClick = (g: VariableGroup) => {
    setActiveItem(null)
    if (g.value !== undefined) commit(g.value, true) // categoria-folha (namespace livre)
    else setActiveGroup(g.key)
  }

  const onItemClick = (it: VariableItem) => {
    if (it.modifiers?.length) setActiveItem(it)        // abre etapa de modificador
    else commit(it.value, it.prefix)                   // combinação única / prefixo
  }

  const panelCls = `absolute right-0 z-30 mt-1 flex min-w-[26rem] rounded-lg border shadow-lg ${
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  }`
  const colCls = 'flex-1 max-h-60 overflow-auto py-1'
  const borderCls = isDark ? 'border-slate-700' : 'border-slate-200'
  const rowCls = (active: boolean) => `w-full text-left text-xs px-2.5 py-1.5 transition-colors ${
    active
      ? (isDark ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-800')
      : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')
  }`

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        className={`${inputCls} ${resolved ? 'cursor-pointer' : 'font-mono'}`}
        value={resolved ? label : value}
        readOnly={resolved}
        onChange={e => onChange(e.target.value)}
        onClick={() => { if (value === '' || resolved) openPicker() }}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          else if (e.key === '@') { e.preventDefault(); openPicker() }
        }}
        placeholder="clique ou digite @ para escolher"
      />
      {open && (
        <div className={panelCls}>
          <ul className={colCls}>
            {VARIABLE_GROUPS.map(g => (
              <li key={g.key}>
                <button
                  type="button"
                  className={rowCls(g.key === activeGroup)}
                  onMouseEnter={() => { if (g.items) { setActiveGroup(g.key); setActiveItem(null) } }}
                  onClick={() => onCategoryClick(g)}
                >{g.label}{g.items ? ' ›' : ''}</button>
              </li>
            ))}
          </ul>
          {group?.items && (
            <ul className={`${colCls} border-l ${borderCls}`}>
              {group.items.map((it: VariableItem) => (
                <li key={it.value}>
                  <button
                    type="button"
                    className={rowCls(activeItem?.value === it.value)}
                    onMouseEnter={() => setActiveItem(it.modifiers?.length ? it : null)}
                    onClick={() => onItemClick(it)}
                  >{it.label}{it.modifiers?.length ? ' ›' : ''}</button>
                </li>
              ))}
            </ul>
          )}
          {activeItem?.modifiers?.length && (
            <ul className={`${colCls} border-l ${borderCls}`}>
              {activeItem.modifiers.map(mod => (
                <li key={mod.suffix || 'none'}>
                  <button type="button" className={rowCls(false)} onClick={() => commit(activeItem.value + mod.suffix)}>{mod.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

interface ConditionTypeFieldsProps {
  type: string
  variable: string
  value: string
  intent: string
  context: string
  onVariable: (v: string) => void
  onValue: (v: string) => void
  onIntent: (v: string) => void
  onContext: (v: string) => void
  intents: BotIntent[]
  isDark: boolean
  inputCls: string
  labelCls: string
}

/**
 * Campos dependentes do TIPO da condição — compartilhado pelos dois editores (a
 * condição individual no modo `condition` e a lista de condições no modo group/solo),
 * pra não divergirem:
 *  - context    → "Intenção" + "Contexto" (IDs de intenções)
 *  - lastIntent → "Intenção"
 *  - empty      → "Variável" (picker de @)
 *  - demais     → "Variável" + "Valor"
 */
function ConditionTypeFields(p: ConditionTypeFieldsProps) {
  const { type, intents, isDark, inputCls, labelCls } = p
  if (type === 'context') {
    return (
      <div className="flex gap-2">
        <label className="flex flex-col gap-1 flex-1">
          <span className={labelCls}>Intenção</span>
          <IntentSelect value={p.intent} onChange={p.onIntent} intents={intents} inputCls={inputCls} emptyLabel="Nenhuma" />
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className={labelCls}>Contexto</span>
          <IntentSelect value={p.context} onChange={p.onContext} intents={intents} inputCls={inputCls} emptyLabel="Nenhum" />
        </label>
      </div>
    )
  }
  if (type === 'lastIntent') {
    return (
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Intenção</span>
        <IntentSelect value={p.intent} onChange={p.onIntent} intents={intents} inputCls={inputCls} emptyLabel="Nenhuma" />
      </label>
    )
  }
  if (type === 'empty') {
    return (
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Variável</span>
        <VariablePicker value={p.variable} onChange={p.onVariable} isDark={isDark} inputCls={inputCls} />
      </label>
    )
  }
  return (
    <div className="flex gap-2">
      <label className="flex flex-col gap-1 flex-1">
        <span className={labelCls}>Variável</span>
        <input className={`${inputCls} font-mono`} value={p.variable} onChange={e => p.onVariable(e.target.value)} placeholder="ex: customer.cpf" />
      </label>
      <label className="flex flex-col gap-1 flex-1">
        <span className={labelCls}>Valor</span>
        <input className={inputCls} value={p.value} onChange={e => p.onValue(e.target.value)} />
      </label>
    </div>
  )
}

interface IntentSelectProps {
  /** ID da intenção selecionada (ou '' para nenhuma). */
  value: string
  onChange: (value: string) => void
  intents: BotIntent[]
  inputCls: string
  /** Rótulo da opção vazia (ex.: "Nenhum" / "Nenhuma"). */
  emptyLabel: string
}

/**
 * Dropdown que seleciona uma intenção existente (value = id, label = nome).
 * Se o valor atual apontar para um ID fora do fluxo carregado, mantém uma opção
 * de fallback para não perder o dado silenciosamente.
 */
function IntentSelect({ value, onChange, intents, inputCls, emptyLabel }: IntentSelectProps) {
  return (
    <select className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {intents.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      {value && !intents.some(i => i.id === value) && (
        <option value={value}>{value} (fora do fluxo)</option>
      )}
    </select>
  )
}

interface DetailPanelProps {
  node: Node<FlowNodeData>
  intent: BotIntent | null
  /** Todas as intenções do fluxo — para o seletor de contexto no modo grupo/solo. */
  intents: BotIntent[]
  /** Categorias conhecidas na sessão — alimenta o dropdown do campo Categoria. */
  categories: string[]
  /** Chamado antes do primeiro patch — o App captura o snapshot de undo aqui. */
  onBeforeApply: () => void
  onApply: (intentId: string) => void
  /** Chamado quando um patch falha no meio — o App faz rollback do parcial. */
  onApplyFailed: () => void
  onDelete: (intentId: string) => void
  /** Duplica a intenção inteira numa nova intenção (modos group/solo). */
  onDuplicateIntent: (intentId: string) => void
  /** Duplica a condição dentro da MESMA intenção (modos condition/solo). */
  onDuplicateConditionInIntent: (intentId: string, condIdx: number) => void
  /** Extrai a condição-filha para uma intenção NOVA (modo condition). */
  onDuplicateConditionOutside: (intentId: string, condIdx: number) => void
  onClose: () => void
}

export function DetailPanel({ node, intent, intents, categories, onBeforeApply, onApply, onApplyFailed, onDelete, onDuplicateIntent, onDuplicateConditionInIntent, onDuplicateConditionOutside, onClose }: DetailPanelProps) {
  const isDark = useTheme()
  const kind = (node.type ?? 'defaultNode') as NodeKind
  const badge = (isDark ? KIND_LABELS_DARK : KIND_LABELS_LIGHT)[kind]
  const { mode, condIdx } = resolveMode(node, intent)
  const [draft, setDraft] = useState<Draft | null>(intent ? buildDraft(intent, mode, condIdx) : null)
  const [panelError, setPanelError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(intent ? buildDraft(intent, mode, condIdx) : null)
    setPanelError(null)
  }, [node.id])

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(d => d ? { ...d, [key]: value } : d)
  }, [])

  /** Atualiza campos da condição `i` na lista de condições (modo group/solo). */
  const patchCond = useCallback((i: number, patch: Partial<DraftCondition>) => {
    setDraft(d => d ? { ...d, conditions: d.conditions.map((c, j) => j === i ? { ...c, ...patch } : c) } : d)
  }, [])

  // Opções do dropdown de Categoria, a partir das categorias conhecidas na sessão.
  // "Sem Categoria" sempre vem primeiro (valor padrão); o resto, ordenado.
  const categoryOptions = useMemo(() => {
    const found = new Set(categories.map(c => c.trim()).filter(Boolean))
    found.delete('Sem Categoria')
    return ['Sem Categoria', ...[...found].sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }, [categories])

  const showMeta    = mode === 'group' || mode === 'solo'
  const showTrigger = mode === 'condition'
  const showContent = mode === 'condition' || mode === 'solo'
  const showCondList = mode === 'group' || mode === 'solo'

  /**
   * Aplica o rascunho via patches pequenos, no escopo do modo (meta da intenção,
   * uma condição, ou conteúdo + lista de condições no solo). Remoções sempre em
   * índice decrescente; remoções de condição por último (refs deslocam).
   */
  function handleApply() {
    if (!intent || !draft) return
    onBeforeApply()
    // `ci`: índice da condição-alvo das funções escopadas. No solo (1 condição)
    // fica undefined → as funções acham a 1ª do tipo, que é a única.
    const ci = mode === 'condition' ? condIdx : undefined
    const results: EditResult[] = []

    if (showMeta) {
      results.push(updateIntentMeta(intent, {
        name: draft.name,
        category: draft.category,
        keywords: draft.keywords.split(',').map(k => k.trim()).filter(Boolean),
        priority: draft.priority,
        context: draft.context,
      }))
    }

    if (showTrigger) {
      results.push(updateCondition(intent, condIdx, {
        name: draft.condName, type: draft.condType, variable: draft.condVariable, value: draft.condValue,
        intent: draft.condIntent, context: draft.condContext,
      }))
    }

    if (showContent) {
      results.push(
        ...draft.messages.map(m => updateMessageText(intent, m.ref, m.text)),
        ...[...draft.removedRefs]
          .sort((a, b) => b.condIdx - a.condIdx || b.sayIdx - a.sayIdx || b.msgIdx - a.msgIdx)
          .map(ref => removeMessage(intent, ref)),
        ...draft.newMessages.filter(t => t.trim()).map(t => addTextMessage(intent, t.trim(), ci ?? 0)),
      )
      if (draft.newButtonsBody !== null && draft.newButtonsBody.trim()) {
        results.push(addButtonsMessage(intent, draft.newButtonsBody.trim(), ci))
      }
      results.push(
        ...draft.buttons
          .filter(b => b.originalIdx !== null)
          .map(b => updateButton(intent, b.originalIdx as number, b.text, b.description || null, ci)),
        ...[...draft.removedButtonIdxs].sort((a, b) => b - a).map(i => removeButton(intent, i, ci)),
        ...draft.buttons
          .filter(b => b.originalIdx === null && b.text.trim())
          .map(b => addButton(intent, b.text.trim(), b.description || null, ci)),
      )
      if (kind === 'transferNode') {
        results.push(updateActionFields(intent, 'transfer', { transferType: draft.transferType, value: draft.transferValue }, ci))
      }
      if (kind === 'captureNode') {
        results.push(updateActionFields(intent, 'captureData', { captureDataType: draft.captureDataType, variable: draft.captureVariable }, ci))
      }
      if (kind === 'setDataNode') {
        results.push(updateSetDataItems(intent, draft.setDataItems, ci))
      }
    }

    if (showCondList) {
      results.push(
        ...draft.conditions
          .filter(c => c.originalIdx !== null)
          .map(c => updateCondition(intent, c.originalIdx as number, c)),
        ...[...draft.removedCondIdxs].sort((a, b) => b - a).map(i => removeCondition(intent, i)),
      )
      for (const added of draft.conditions.filter(c => c.originalIdx === null && c.name.trim())) {
        const addResult = addCondition(intent, added.kind)
        results.push(addResult.ok ? updateCondition(intent, intent.conditions.length - 1, added) : addResult)
      }
    }

    const failed = results.find(r => !r.ok)
    if (failed && !failed.ok) {
      setPanelError(`Falha ao aplicar: ${failed.reason}.`)
      onApplyFailed()
      return
    }
    setPanelError(null)
    onApply(intent.id)
    setDraft(buildDraft(intent, mode, condIdx))
  }

  /** Exclui a condição atual (modo filho) — só permitida se houver mais de uma. */
  function handleDeleteCondition() {
    if (!intent) return
    onBeforeApply()
    const result = removeCondition(intent, condIdx)
    if (!result.ok) {
      setPanelError(`Não foi possível excluir: ${result.reason}.`)
      onApplyFailed()
      return
    }
    onApply(intent.id)
    onClose()
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
  const dashedBtnCls = `text-xs font-medium rounded-lg border border-dashed px-2 py-1.5 transition-colors ${
    isDark ? 'text-slate-400 border-slate-700 hover:bg-slate-800' : 'text-slate-500 border-slate-300 hover:bg-slate-50'
  }`
  const dupBtnCls = `w-full text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
    isDark ? 'text-indigo-300 border-indigo-900 hover:bg-indigo-950' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
  }`

  const editable = !!intent && !!draft && mode !== 'externalRO' && mode !== 'startRO'
  const canDeleteCondition = mode === 'condition' && !!intent && intent.conditions.length > 1

  return (
    <div data-testid="detail-panel" className={`absolute right-0 top-0 h-full w-96 border-l shadow-xl z-10 flex flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
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
        {mode === 'externalRO' && <ReadOnlyExternal node={node} isDark={isDark} />}
        {mode === 'startRO' && intent && <ReadOnlyStart intent={intent} isDark={isDark} />}

        {editable && draft && (
          <>
            {mode === 'condition' && (
              <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Editando <strong>uma condição</strong> da intenção. Para nome, categoria,
                prioridade e contexto, clique no cabeçalho da intenção.
              </p>
            )}

            {showMeta && (
              <Section title="Geral" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Nome</span>
                    <input className={inputCls} value={draft.name} onChange={e => set('name', sanitizeIntentName(e.target.value))} />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className={labelCls}>Categoria</span>
                    <CategorySelect
                      value={draft.category}
                      onChange={v => set('category', v)}
                      options={categoryOptions}
                      isDark={isDark}
                      inputCls={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={labelCls}>Palavras-chave</span>
                    <KeywordTags value={draft.keywords} onChange={v => set('keywords', v)} isDark={isDark} />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex flex-col gap-1 flex-1">
                      <span className={labelCls}>Prioridade</span>
                      <select className={inputCls} value={draft.priority} onChange={e => set('priority', Number(e.target.value))}>
                        {PRIORITY_LABELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                      <span className={labelCls}>Contexto (intenção que precede)</span>
                      <IntentSelect
                        value={draft.context}
                        onChange={v => set('context', v)}
                        intents={intents.filter(i => i.id !== intent!.id)}
                        inputCls={inputCls}
                        emptyLabel="Nenhum"
                      />
                    </label>
                  </div>
                </div>
              </Section>
            )}

            {showTrigger && draft && (
              <Section title="Gatilho da condição" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Nome da condição</span>
                    <input className={inputCls} value={draft.condName} onChange={e => set('condName', e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Tipo de gatilho</span>
                    <select className={inputCls} value={draft.condType} onChange={e => set('condType', e.target.value)}>
                      {COND_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      {!COND_TYPE_OPTIONS.some(t => t.value === draft.condType) && (
                        <option value={draft.condType}>{draft.condType}</option>
                      )}
                    </select>
                  </label>
                  <ConditionTypeFields
                    type={draft.condType}
                    variable={draft.condVariable} value={draft.condValue}
                    intent={draft.condIntent} context={draft.condContext}
                    onVariable={v => set('condVariable', v)} onValue={v => set('condValue', v)}
                    onIntent={v => set('condIntent', v)} onContext={v => set('condContext', v)}
                    intents={intents} isDark={isDark} inputCls={inputCls} labelCls={labelCls}
                  />
                </div>
              </Section>
            )}

            {showContent && draft && (
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
                  <button className={dashedBtnCls} onClick={() => set('newMessages', [...draft.newMessages, ''])}>
                    + Adicionar mensagem de texto
                  </button>
                </div>
              </Section>
            )}

            {showContent && draft && (draft.buttons.length > 0 || kind === 'choiceNode') && (
              <Section title="Opções (botões ↔ escolhas)" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  {draft.buttons.map((btn, i) => (
                    <div key={i} className={`flex flex-col gap-1 border rounded-lg p-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-1.5">
                        <input
                          className={inputCls}
                          value={btn.text}
                          placeholder="Texto do botão"
                          onChange={e => set('buttons', draft.buttons.map((b, j) => j === i ? { ...b, text: e.target.value } : b))}
                        />
                        {kind === 'choiceNode' && (
                          <button
                            className={ghostBtnCls}
                            title="Remover botão e a escolha correspondente"
                            onClick={() => setDraft(d => d && ({
                              ...d,
                              buttons: d.buttons.filter((_, j) => j !== i),
                              removedButtonIdxs: btn.originalIdx !== null
                                ? [...d.removedButtonIdxs, btn.originalIdx]
                                : d.removedButtonIdxs,
                            }))}
                          >×</button>
                        )}
                      </div>
                      <input
                        className={inputCls}
                        value={btn.description}
                        placeholder="Descrição (opcional)"
                        onChange={e => set('buttons', draft.buttons.map((b, j) => j === i ? { ...b, description: e.target.value } : b))}
                      />
                      {btn.originalIdx === null && (
                        <p className={labelCls}>novo — conecte no canvas após aplicar</p>
                      )}
                    </div>
                  ))}

                  {kind === 'choiceNode' && !hasButtonsMessage(intent!, condIdx, mode) && draft.newButtonsBody === null && (
                    <button className={dashedBtnCls} onClick={() => set('newButtonsBody', '')}>
                      + Criar mensagem de botões
                    </button>
                  )}
                  {draft.newButtonsBody !== null && (
                    <label className="flex flex-col gap-1">
                      <span className={labelCls}>Corpo da mensagem de botões (nova)</span>
                      <textarea
                        className={`${inputCls} resize-y min-h-[56px]`}
                        value={draft.newButtonsBody}
                        placeholder="Texto que acompanha os botões…"
                        onChange={e => set('newButtonsBody', e.target.value)}
                      />
                    </label>
                  )}
                  {kind === 'choiceNode' && (hasButtonsMessage(intent!, condIdx, mode) || draft.newButtonsBody !== null) && (
                    <button
                      className={dashedBtnCls}
                      onClick={() => set('buttons', [...draft.buttons, { text: '', description: '', originalIdx: null }])}
                    >+ Adicionar botão</button>
                  )}
                </div>
              </Section>
            )}

            {showContent && draft && kind === 'transferNode' && (
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

            {showContent && draft && kind === 'captureNode' && (
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

            {showContent && draft && kind === 'setDataNode' && (
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
                  <button className={dashedBtnCls} onClick={() => set('setDataItems', [...draft.setDataItems, { variable: '', value: '' }])}>
                    + Adicionar variável
                  </button>
                </div>
              </Section>
            )}

            {showCondList && draft && (
              <Section title="Condições" isDark={isDark}>
                <div className="flex flex-col gap-2">
                  {mode === 'group' && (
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Clique num nó-condição no canvas para editar mensagens e ação.
                    </p>
                  )}
                  {draft.conditions.map((cond, i) => (
                    <div key={i} className={`flex flex-col gap-1 border rounded-lg p-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-1.5">
                        <input
                          className={inputCls}
                          value={cond.name}
                          placeholder="Nome da condição"
                          onChange={e => patchCond(i, { name: e.target.value })}
                        />
                        <button
                          className={ghostBtnCls}
                          title="Remover condição"
                          onClick={() => setDraft(d => d && ({
                            ...d,
                            conditions: d.conditions.filter((_, j) => j !== i),
                            removedCondIdxs: cond.originalIdx !== null
                              ? [...d.removedCondIdxs, cond.originalIdx]
                              : d.removedCondIdxs,
                          }))}
                        >×</button>
                      </div>
                      <select
                        className={inputCls}
                        value={cond.type}
                        onChange={e => patchCond(i, { type: e.target.value })}
                      >
                        {COND_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        {!COND_TYPE_OPTIONS.some(t => t.value === cond.type) && (
                          <option value={cond.type}>{cond.type}</option>
                        )}
                      </select>
                      <ConditionTypeFields
                        type={cond.type}
                        variable={cond.variable} value={cond.value}
                        intent={cond.intent} context={cond.context}
                        onVariable={v => patchCond(i, { variable: v })}
                        onValue={v => patchCond(i, { value: v })}
                        onIntent={v => patchCond(i, { intent: v })}
                        onContext={v => patchCond(i, { context: v })}
                        intents={intents} isDark={isDark} inputCls={inputCls} labelCls={labelCls}
                      />
                      {cond.originalIdx === null && (
                        <div className="flex items-center gap-1.5">
                          <span className={`${labelCls} shrink-0`}>Ação:</span>
                          <select
                            className={inputCls}
                            value={cond.kind ?? 'defaultNode'}
                            onChange={e => patchCond(i, { kind: e.target.value as CreatableKind })}
                          >
                            {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                          </select>
                          <span className={`${labelCls} shrink-0`}>nova — aplicada ao salvar</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    className={dashedBtnCls}
                    onClick={() => set('conditions', [...draft.conditions, { name: `Condição ${draft.conditions.length + 1}`, type: 'any', variable: '', value: 'any', intent: '', context: '', originalIdx: null, kind: 'defaultNode' }])}
                  >+ Adicionar condição</button>
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
          {(mode === 'condition' || mode === 'solo') && intent && (
            <div className="flex gap-2">
              <button
                onClick={() => onDuplicateConditionInIntent(intent.id, condIdx)}
                className={`${dupBtnCls} flex-1 min-w-0`}
              >Duplicar Condição</button>
              {mode === 'condition' && (
                <button
                  onClick={() => onDuplicateConditionOutside(intent.id, condIdx)}
                  className={`${dupBtnCls} flex-1 min-w-0`}
                >Duplicar Intenção</button>
              )}
              {mode === 'solo' && (
                <button
                  onClick={() => onDuplicateIntent(intent.id)}
                  className={`${dupBtnCls} flex-1 min-w-0`}
                >Duplicar Intenção</button>
              )}
            </div>
          )}
          {mode === 'group' && intent && (
            <button
              onClick={() => onDuplicateIntent(intent.id)}
              className={dupBtnCls}
            >Duplicar Intenção</button>
          )}
          {canDeleteCondition && (
            <button
              onClick={handleDeleteCondition}
              className={`w-full text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                isDark ? 'text-rose-400 border-rose-900 hover:bg-rose-950' : 'text-rose-600 border-rose-200 hover:bg-rose-50'
              }`}
            >Excluir condição</button>
          )}
          {showMeta && kind !== 'startNode' && (
            <button
              onClick={() => intent && onDelete(intent.id)}
              className={`w-full text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                isDark
                  ? 'text-rose-400 border-rose-900 hover:bg-rose-950'
                  : 'text-rose-600 border-rose-200 hover:bg-rose-50'
              }`}
            >Excluir intenção</button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Visão somente-leitura do nó de início. O start é canônico e imutável aqui — a
 * única ação estrutural permitida é conectar/remover a aresta de saída no canvas.
 */
function ReadOnlyStart({ intent, isDark }: { intent: BotIntent; isDark: boolean }) {
  const cond = intent.conditions[0]
  const next = cond?.next?.intent
  const nextId = next && typeof next === 'object' ? next.id : (typeof next === 'string' ? next : null)
  return (
    <Section title="Nó de início (somente leitura)" isDark={isDark}>
      <p className={`text-[11px] leading-snug mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        O nó de início não é editável. Para definir por onde o fluxo começa,
        conecte a aresta de saída a outra intenção no canvas.
      </p>
      <InfoRow label="Nome"     value={intent.name || '-'} isDark={isDark} />
      <InfoRow label="Condição" value={cond?.name || '-'} isDark={isDark} />
      <InfoRow label="Próximo"  value={nextId ?? '(sem destino — conecte no canvas)'} isDark={isDark} />
    </Section>
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
