import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import type {
  BotFlowJson, BotIntent, Condition, Action,
  ButtonOption, BulkUpdateItem, FlowNodeData, NodeKind, ConditionInfo,
} from '../types'

const NODE_SIZES: Record<NodeKind, { w: number; h: number }> = {
  startNode:       { w: 180, h: 56 },
  choiceNode:      { w: 260, h: 200 },
  captureNode:     { w: 260, h: 160 },
  transferNode:    { w: 260, h: 140 },
  waitNode:        { w: 260, h: 130 },
  setDataNode:     { w: 260, h: 130 },
  externalBotNode: { w: 260, h: 150 },
  defaultNode:     { w: 260, h: 130 },
}

const GENERIC_CONDITION_NAMES = new Set([
  'Condição Padrão', 'Condição padrão', 'Condição 2', 'Condição 3', 'Condição 4', 'Start',
])

// ─── Intent data helpers ───────────────────────────────────────────────────

function getNodeKind(intent: BotIntent): NodeKind {
  if (intent.category === 'start') return 'startNode'
  for (const c of intent.conditions) if (c.action.type === 'transfer') return 'transferNode'
  for (const c of intent.conditions) if (c.action.type === 'waitForInteraction') return 'waitNode'
  for (const c of intent.conditions) if (c.action.type === 'choice') return 'choiceNode'
  for (const c of intent.conditions) if (c.action.type === 'captureData') return 'captureNode'
  for (const c of intent.conditions) if (c.action.type === 'setData') return 'setDataNode'
  return 'defaultNode'
}

function getChoices(action: Action): string[] {
  if (!Array.isArray(action.choices)) return []
  const seen = new Set<string>()
  return action.choices.filter(id => { if (!id || seen.has(id)) return false; seen.add(id); return true })
}

function getMessagePreview(intent: BotIntent): string {
  for (const cond of intent.conditions)
    for (const say of cond.assistant_says)
      for (const msg of say.messages) {
        if (msg.type === 'TEXT' && msg.content) return msg.content.slice(0, 120)
        if ((msg.type === 'BUTTON' || msg.type === 'LIST') && msg.messageConfig?.body)
          return msg.messageConfig.body.slice(0, 120)
      }
  return ''
}

function getAllMessages(intent: BotIntent): string[] {
  const seen = new Set<string>(); const result: string[] = []
  for (const cond of intent.conditions)
    for (const say of cond.assistant_says)
      for (const msg of say.messages) {
        let text = ''
        if (msg.type === 'TEXT' && msg.content) text = msg.content
        else if ((msg.type === 'BUTTON' || msg.type === 'LIST') && msg.messageConfig?.body)
          text = msg.messageConfig.body
        if (text && !seen.has(text)) { seen.add(text); result.push(text) }
      }
  return result
}

function getButtons(intent: BotIntent): ButtonOption[] {
  for (const cond of intent.conditions)
    for (const say of cond.assistant_says)
      for (const msg of say.messages)
        if ((msg.type === 'BUTTON' || msg.type === 'LIST') && msg.messageConfig?.buttons?.length)
          return msg.messageConfig.buttons
  return []
}

function getCaptureDataType(intent: BotIntent): string | null {
  for (const c of intent.conditions) if (c.action.captureDataType) return c.action.captureDataType
  return null
}

function getTransferType(intent: BotIntent): string | null {
  for (const c of intent.conditions) if (c.action.transferType) return c.action.transferType
  return null
}

function getTransferValue(intent: BotIntent): string | null {
  for (const c of intent.conditions)
    if (c.action.type === 'transfer' && c.action.value) return c.action.value
  return null
}

function getConditionInfos(intent: BotIntent): ConditionInfo[] {
  return intent.conditions
    .filter(c => c.variable || !GENERIC_CONDITION_NAMES.has(c.name))
    .map(c => ({ name: c.name, type: c.type, variable: c.variable ?? null }))
}

function getSetDataItems(intent: BotIntent): BulkUpdateItem[] {
  for (const cond of intent.conditions)
    if (cond.action.type === 'setData' && Array.isArray(cond.action.bulkUpdate))
      return cond.action.bulkUpdate as BulkUpdateItem[]
  return []
}

function getButtonLabel(cond: Condition, idx: number): string {
  for (const say of cond.assistant_says)
    for (const msg of say.messages)
      if ((msg.type === 'BUTTON' || msg.type === 'LIST') && msg.messageConfig?.buttons?.[idx])
        return msg.messageConfig.buttons[idx].text
  return `Opção ${idx + 1}`
}

function getEdgeLabel(cond: Condition, choiceIdx?: number): string {
  if (choiceIdx !== undefined) return getButtonLabel(cond, choiceIdx)
  if (cond.type === 'equals' && cond.value && cond.value !== 'any') return `= ${cond.value}`
  if (cond.type === 'else') return 'senão'
  if (cond.type === 'exists') return cond.variable ? `existe: ${cond.variable}` : 'existe'
  return GENERIC_CONDITION_NAMES.has(cond.name) ? '' : cond.name
}

function getNextRef(next: Condition['next']): { id: string; botId: string } | null {
  if (!next?.intent || typeof next.intent !== 'object') return null
  const { id, botId } = next.intent as { id: string; botId: string }
  return id ? { id, botId: botId ?? '' } : null
}

function edgeStyle(external: boolean) {
  return {
    type: 'smoothstep' as const,
    animated: external,
    style: { stroke: external ? '#f59e0b' : '#94a3b8' },
    labelStyle: { fontSize: 11, fill: '#475569' },
    labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  }
}

// ─── Layout ────────────────────────────────────────────────────────────────

function dagreLayout(nodes: Node<FlowNodeData>[], edges: Edge[]): Node<FlowNodeData>[] {
  if (!nodes.length) return []
  const ids = new Set(nodes.map(n => n.id))
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 28, nodesep: 18 })
  nodes.forEach(n => {
    const s = NODE_SIZES[n.type as NodeKind] ?? NODE_SIZES.defaultNode
    g.setNode(n.id, { width: s.w, height: s.h })
  })
  edges.filter(e => ids.has(e.source) && ids.has(e.target)).forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const pos = g.node(n.id)
    const s = NODE_SIZES[n.type as NodeKind] ?? NODE_SIZES.defaultNode
    return { ...n, position: { x: pos.x - s.w / 2, y: pos.y - s.h / 2 } }
  })
}

// ─── Public API ────────────────────────────────────────────────────────────

export function parseFlow(json: BotFlowJson): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const intents   = json.list
  const mainBotId = intents.find(i => i.category === 'start')?.botId ?? intents[0]?.botId ?? ''
  const intentIds = new Set(intents.map(i => i.id))

  const externalNodeMap = new Map<string, Node<FlowNodeData>>()

  const internalNodes: Node<FlowNodeData>[] = intents.map(intent => ({
    id:   intent.id,
    type: getNodeKind(intent),
    position: { x: 0, y: 0 },
    data: {
      name:            intent.name,
      category:        intent.category,
      messagePreview:  getMessagePreview(intent),
      buttons:         getButtons(intent),
      actionType:      intent.conditions[0]?.action.type ?? 'none',
      captureDataType: getCaptureDataType(intent),
      transferType:    getTransferType(intent),
      transferValue:   getTransferValue(intent),
      allMessages:     getAllMessages(intent),
      setDataItems:    getSetDataItems(intent),
      keywords:        intent.keywords ?? [],
      conditions:      getConditionInfos(intent),
    },
  }))

  const edges: Edge[] = []

  for (const intent of intents) {
    for (let ci = 0; ci < intent.conditions.length; ci++) {
      const cond    = intent.conditions[ci]
      const choices = getChoices(cond.action)

      if (cond.action.type === 'choice' && choices.length > 0) {
        choices.forEach((choiceId, idx) => {
          if (!intentIds.has(choiceId)) return
          edges.push({
            id: `${intent.id}-c${ci}-ch${idx}`,
            source: intent.id,
            target: choiceId,
            label: getEdgeLabel(cond, idx),
            ...edgeStyle(false),
          })
        })
        continue
      }

      const ref = getNextRef(cond.next)
      if (!ref) continue

      const isExternal = cond.next.action === 'bot' || (!!ref.botId && ref.botId !== mainBotId)

      if (isExternal) {
        const extId = `ext-${intent.id}-c${ci}`
        externalNodeMap.set(extId, {
          id: extId, type: 'externalBotNode', position: { x: 0, y: 0 },
          data: {
            name: 'Outro Bot', category: 'Redirecionamento externo',
            messagePreview: '', buttons: [], actionType: 'none',
            captureDataType: null, transferType: null, transferValue: null,
            allMessages: [], setDataItems: [], keywords: [], conditions: [],
            externalBotId: ref.botId, externalIntentId: ref.id,
          },
        })
        edges.push({
          id: `${intent.id}-c${ci}-ext`,
          source: intent.id, target: extId,
          label: getEdgeLabel(cond),
          ...edgeStyle(true),
        })
      } else if (intentIds.has(ref.id)) {
        edges.push({
          id: `${intent.id}-c${ci}-next`,
          source: intent.id, target: ref.id,
          label: getEdgeLabel(cond),
          ...edgeStyle(false),
        })
      }
    }
  }

  const allNodes = [...internalNodes, ...Array.from(externalNodeMap.values())]
  return { nodes: dagreLayout(allNodes, edges), edges }
}
