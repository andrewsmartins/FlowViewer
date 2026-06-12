import type { BotFlowJson, BotIntent, Condition } from '../types'

/**
 * Referência decodificada de um ID de aresta gerado pelo parseFlow.
 * O ID codifica a posição exata no modelo que originou a aresta:
 * `{intentId}-c{condIdx}-next` | `{intentId}-c{condIdx}-ch{choiceIdx}` | `{intentId}-c{condIdx}-ext`
 */
export type EdgeRef =
  | { kind: 'next'; intentId: string; condIdx: number }
  | { kind: 'choice'; intentId: string; condIdx: number; choiceIdx: number }
  | { kind: 'ext'; intentId: string; condIdx: number }

export type EditResult = { ok: true } | { ok: false; reason: string }

const EDGE_ID_RE = /^(.+)-c(\d+)-(next|ext|ch(\d+))$/

/**
 * Decodifica o ID de uma aresta de volta para a posição (intenção + condição)
 * que a originou no modelo. IDs de intenção contêm hífens (UUIDs e `{botId}-start`),
 * por isso o sufixo é ancorado no fim. Retorna null para IDs fora do padrão.
 */
export function parseEdgeId(edgeId: string): EdgeRef | null {
  const m = EDGE_ID_RE.exec(edgeId)
  if (!m) return null
  const [, intentId, condIdxStr, suffix, choiceIdxStr] = m
  const condIdx = Number(condIdxStr)
  if (suffix === 'next') return { kind: 'next', intentId, condIdx }
  if (suffix === 'ext') return { kind: 'ext', intentId, condIdx }
  return { kind: 'choice', intentId, condIdx, choiceIdx: Number(choiceIdxStr) }
}

function findCondition(json: BotFlowJson, ref: EdgeRef): { intent: BotIntent; cond: Condition } | null {
  const intent = json.list.find(i => i.id === ref.intentId)
  const cond = intent?.conditions[ref.condIdx]
  return intent && cond ? { intent, cond } : null
}

function reconnectNext(cond: Condition, target: BotIntent): EditResult {
  if (!cond.next || typeof cond.next.intent === 'string' || !cond.next.intent) {
    return { ok: false, reason: 'a condição não possui um destino editável' }
  }
  cond.next.intent = { botId: target.botId, id: target.id }
  return { ok: true }
}

function reconnectChoice(cond: Condition, oldTargetId: string, newTargetId: string): EditResult {
  if (!Array.isArray(cond.action.choices)) {
    return { ok: false, reason: 'a ação não possui lista de escolhas' }
  }
  // Arestas de escolha são deduplicadas na renderização, então um destino pode
  // aparecer em mais de uma posição de `choices` — substitui todas por valor.
  let replaced = false
  cond.action.choices = cond.action.choices.map(id => {
    if (id !== oldTargetId) return id
    replaced = true
    return newTargetId
  })
  return replaced ? { ok: true } : { ok: false, reason: 'destino original não encontrado nas escolhas' }
}

/**
 * Aplica no modelo a reconexão de uma aresta para um novo destino, mutando o
 * JSON original em memória (fonte de verdade preservada para exportação).
 * Arestas externas (`-ext`) apontam para nós sintéticos de outro bot e não são
 * editáveis nesta fase.
 */
export function applyEdgeReconnect(
  json: BotFlowJson,
  edgeId: string,
  oldTargetId: string,
  newTargetId: string,
): EditResult {
  const ref = parseEdgeId(edgeId)
  if (!ref) return { ok: false, reason: `aresta com ID desconhecido (${edgeId})` }
  if (ref.kind === 'ext') return { ok: false, reason: 'conexões para outros bots não são editáveis' }

  const found = findCondition(json, ref)
  if (!found) return { ok: false, reason: 'intenção ou condição de origem não encontrada no modelo' }

  const target = json.list.find(i => i.id === newTargetId)
  if (!target) return { ok: false, reason: 'o novo destino não é uma intenção deste fluxo' }

  return ref.kind === 'next'
    ? reconnectNext(found.cond, target)
    : reconnectChoice(found.cond, oldTargetId, newTargetId)
}

function hasNextRef(cond: Condition): boolean {
  return !!cond.next?.intent && typeof cond.next.intent === 'object' && !!cond.next.intent.id
}

/**
 * Conecta a origem a um novo destino criando a referência `next.intent` na
 * primeira condição livre (sem destino e que não seja de escolha — arestas de
 * escolha nascem de `action.choices`, não de `next`).
 * Retorna o índice da condição usada para que o App construa a aresta com o
 * ID posicional correto.
 */
export function applyConnect(
  json: BotFlowJson,
  sourceId: string,
  targetId: string,
): { ok: true; condIdx: number } | { ok: false; reason: string } {
  const source = json.list.find(i => i.id === sourceId)
  if (!source) return { ok: false, reason: 'intenção de origem não encontrada no modelo' }

  const target = json.list.find(i => i.id === targetId)
  if (!target) return { ok: false, reason: 'o destino não é uma intenção deste fluxo' }

  const condIdx = source.conditions.findIndex(c => c.action.type !== 'choice' && !hasNextRef(c))
  if (condIdx === -1) {
    return { ok: false, reason: 'todas as condições da origem já têm destino (reconecte a aresta existente)' }
  }

  const cond = source.conditions[condIdx]
  cond.next = {
    ...cond.next,
    redirect: 'continueFlow',
    action: 'intent',
    type: cond.next?.type ?? 'context',
    intent: { botId: target.botId, id: target.id },
  }
  return { ok: true, condIdx }
}

/**
 * Remove o destino de uma aresta `-next`, restaurando a forma canônica de uma
 * condição sem referência (`{ redirect: 'waitInteraction', type }`).
 * Arestas de escolha não são deletáveis: remover uma choice exigiria remover o
 * botão correspondente (mapeamento posicional) — escopo da Fase 3.
 */
export function applyEdgeDelete(json: BotFlowJson, edgeId: string): EditResult {
  const ref = parseEdgeId(edgeId)
  if (!ref) return { ok: false, reason: `aresta com ID desconhecido (${edgeId})` }
  if (ref.kind === 'ext') return { ok: false, reason: 'conexões para outros bots não são editáveis' }
  if (ref.kind === 'choice') {
    return { ok: false, reason: 'arestas de escolha não podem ser excluídas (o botão correspondente ficaria órfão)' }
  }

  const found = findCondition(json, ref)
  if (!found) return { ok: false, reason: 'intenção ou condição de origem não encontrada no modelo' }
  if (!hasNextRef(found.cond)) return { ok: false, reason: 'a condição não possui destino para remover' }

  found.cond.next = { redirect: 'waitInteraction', type: found.cond.next.type ?? 'context' }
  return { ok: true }
}

/**
 * Serializa o modelo de volta para o JSON aceito pela plataforma (`{ list: [...] }`).
 * Não normaliza nem reconstrói nada: o objeto original é preservado e apenas os
 * patches aplicados pelas edições aparecem na saída (estratégia preserve-and-patch).
 */
export function serializeFlow(json: BotFlowJson): string {
  return JSON.stringify(json, null, 2)
}
