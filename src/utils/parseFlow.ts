import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import type { BotFlowJson, BotIntent, Condition, ButtonOption, FlowNodeData, NodeKind } from '../types'

const NODE_SIZES: Record<NodeKind, { w: number; h: number }> = {
  startNode:    { w: 180, h: 56 },
  choiceNode:   { w: 260, h: 200 },
  captureNode:  { w: 260, h: 160 },
  transferNode: { w: 260, h: 140 },
  defaultNode:  { w: 260, h: 140 },
}

function getNodeKind(intent: BotIntent): NodeKind {
  if (intent.category === 'start') return 'startNode'
  for (const cond of intent.conditions) {
    if (cond.action.type === 'transfer') return 'transferNode'
  }
  for (const cond of intent.conditions) {
    if (cond.action.type === 'choice') return 'choiceNode'
  }
  for (const cond of intent.conditions) {
    if (cond.action.type === 'captureData') return 'captureNode'
  }
  return 'defaultNode'
}

function getMessagePreview(intent: BotIntent): string {
  for (const cond of intent.conditions) {
    for (const say of cond.assistant_says) {
      for (const msg of say.messages) {
        if (msg.type === 'TEXT' && msg.content) return msg.content.slice(0, 120)
        if (msg.type === 'BUTTON' && msg.messageConfig?.body) return msg.messageConfig.body.slice(0, 120)
      }
    }
  }
  return ''
}

function getButtons(intent: BotIntent): ButtonOption[] {
  for (const cond of intent.conditions) {
    for (const say of cond.assistant_says) {
      for (const msg of say.messages) {
        if (msg.type === 'BUTTON' && msg.messageConfig?.buttons?.length) {
          return msg.messageConfig.buttons
        }
      }
    }
  }
  return []
}

function getCaptureDataType(intent: BotIntent): string | null {
  for (const cond of intent.conditions) {
    if (cond.action.captureDataType) return cond.action.captureDataType
  }
  return null
}

function getTransferType(intent: BotIntent): string | null {
  for (const cond of intent.conditions) {
    if (cond.action.transferType) return cond.action.transferType
  }
  return null
}

function getButtonLabel(cond: Condition, idx: number): string {
  for (const say of cond.assistant_says) {
    for (const msg of say.messages) {
      if (msg.type === 'BUTTON' && msg.messageConfig?.buttons?.[idx]) {
        return msg.messageConfig.buttons[idx].text
      }
    }
  }
  return `Opção ${idx + 1}`
}

function getNextIntentId(next: Condition['next']): string | null {
  if (!next?.intent) return null
  if (typeof next.intent === 'string') return next.intent
  if (typeof next.intent === 'object' && 'id' in next.intent) return next.intent.id
  return null
}

function applyDagreLayout(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Node<FlowNodeData>[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 })

  nodes.forEach(n => {
    const size = NODE_SIZES[n.type as NodeKind] ?? NODE_SIZES.defaultNode
    g.setNode(n.id, { width: size.w, height: size.h })
  })

  edges.forEach(e => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    const size = NODE_SIZES[n.type as NodeKind] ?? NODE_SIZES.defaultNode
    return {
      ...n,
      position: { x: pos.x - size.w / 2, y: pos.y - size.h / 2 },
    }
  })
}

export function parseFlow(json: BotFlowJson): {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
} {
  const intents = json.list
  const intentIds = new Set(intents.map(i => i.id))

  const nodes: Node<FlowNodeData>[] = intents.map(intent => ({
    id: intent.id,
    type: getNodeKind(intent),
    position: { x: 0, y: 0 },
    data: {
      name: intent.name,
      category: intent.category,
      messagePreview: getMessagePreview(intent),
      buttons: getButtons(intent),
      actionType: intent.conditions[0]?.action.type ?? 'none',
      captureDataType: getCaptureDataType(intent),
      transferType: getTransferType(intent),
    },
  }))

  const edges: Edge[] = []

  for (const intent of intents) {
    for (let ci = 0; ci < intent.conditions.length; ci++) {
      const cond = intent.conditions[ci]

      if (cond.action.type === 'choice' && Array.isArray(cond.action.choices)) {
        cond.action.choices.forEach((choiceId, idx) => {
          if (intentIds.has(choiceId)) {
            edges.push({
              id: `${intent.id}-c${ci}-ch${idx}`,
              source: intent.id,
              target: choiceId,
              label: getButtonLabel(cond, idx),
              type: 'smoothstep',
              style: { stroke: '#94a3b8' },
              labelStyle: { fontSize: 11, fill: '#475569' },
              labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
              labelBgPadding: [4, 6],
              labelBgBorderRadius: 4,
            })
          }
        })
      } else {
        const nextId = getNextIntentId(cond.next)
        if (nextId && intentIds.has(nextId)) {
          const label = cond.name !== 'Condição Padrão' && cond.name !== 'Condição 2'
            ? cond.name
            : ''
          edges.push({
            id: `${intent.id}-c${ci}-next`,
            source: intent.id,
            target: nextId,
            label,
            type: 'smoothstep',
            style: { stroke: '#94a3b8' },
            labelStyle: { fontSize: 11, fill: '#475569' },
            labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
            labelBgPadding: [4, 6],
            labelBgBorderRadius: 4,
          })
        }
      }
    }
  }

  const layoutedNodes = applyDagreLayout(nodes, edges)
  return { nodes: layoutedNodes, edges }
}
