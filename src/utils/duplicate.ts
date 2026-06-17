import type { BotIntent, Condition } from '../types'
import type { EditResult } from './editFlow'

/**
 * Duplicação de nós (Fase 7) — núcleo puro e testável.
 *
 * Cobre as 3 formas de duplicação do editor:
 *  1. `cloneIntent` — copia uma intenção inteira (todas as condições) numa nova
 *     intenção (Ctrl+arrastar e botão "Duplicar intenção" no painel).
 *  2. `duplicateConditionInIntent` — copia UMA condição dentro da MESMA intenção
 *     (botão "Duplicar dentro da intenção"; nó solto vira grupo).
 *  3. `intentFromCondition` — extrai UMA condição para uma intenção NOVA
 *     (botão "Duplicar fora da intenção", a partir de uma condição-filha).
 *
 * Decisão de desenho (Andy, 2026-06-16): a cópia é FIEL — preserva as conexões de
 * saída (`next.intent`, `action.choices`, `error.next`, `context`, `fallbackIntents`),
 * de modo que o que apontava para fora continua apontando. Só os IDs de BOTÕES são
 * regerados (UUID novo), para não colidir com os da intenção original. Nada aponta
 * PARA a cópia (entrada vazia — esperado numa duplicata). O nó de início (`start`)
 * nunca é duplicado — a guarda fica nos callers (App), pois eles têm o contexto do nó.
 */

/**
 * Regera os IDs de todos os botões (BUTTON/LIST) de uma condição. Os botões mapeiam
 * POSICIONALMENTE para `action.choices` (buttons[i] ↔ choices[i]), então trocar o `id`
 * do botão é seguro — `choices` guarda IDs de INTENÇÃO, não de botão. Necessário para
 * a cópia não compartilhar IDs de botão com o original.
 */
export function regenButtonIds(cond: Condition): void {
  for (const say of cond.assistant_says) {
    for (const msg of say.messages) {
      const buttons = msg.messageConfig?.buttons
      if (Array.isArray(buttons)) {
        for (const btn of buttons) btn.id = crypto.randomUUID()
      }
    }
  }
}

/** Cópia profunda de uma condição com IDs de botão regerados. Refs de saída preservadas. */
export function cloneCondition(cond: Condition): Condition {
  const copy = structuredClone(cond)
  regenButtonIds(copy)
  return copy
}

/**
 * Gera um nome único a partir de `base`, sufixando `_copia`, `_copia_2`, `_copia_3`…
 * até não colidir com `existing`. `validateFlow` só barra ID de intenção duplicado
 * (não nome), mas nomes repetidos confundem — então garantimos unicidade.
 */
export function makeUniqueName(existing: Set<string>, base: string): string {
  const first = `${base}_copia`
  if (!existing.has(first)) return first
  let n = 2
  while (existing.has(`${base}_copia_${n}`)) n++
  return `${base}_copia_${n}`
}

/** Conjunto dos nomes das intenções de um fluxo (para `makeUniqueName`). */
function namesOf(intents: BotIntent[]): Set<string> {
  return new Set(intents.map(i => i.name))
}

/**
 * Duplica UMA condição dentro da MESMA intenção (feature 2). A condição copiada vai
 * para o fim de `conditions` (com IDs de botão regerados). Numa intenção de 1 condição
 * (nó solto), isso a transforma em grupo (2 condições).
 */
export function duplicateConditionInIntent(intent: BotIntent, condIdx: number): EditResult {
  const cond = intent.conditions[condIdx]
  if (!cond) return { ok: false, reason: 'condição não encontrada na intenção' }
  intent.conditions.push(cloneCondition(cond))
  intent.updatedAt = new Date().toUTCString()
  return { ok: true }
}

/**
 * Copia uma intenção inteira numa nova intenção (feature 1 e feature 3 no nível da
 * intenção). Recebe a lista atual para gerar um nome único. ID novo (UUID v4),
 * timestamps novos, IDs de botão regerados em TODAS as condições. Refs de saída
 * preservadas. O caller garante que `intent` não é o nó de início.
 */
export function cloneIntent(intent: BotIntent, existing: BotIntent[]): BotIntent {
  const copy = structuredClone(intent)
  const now = new Date().toUTCString()
  copy.id = crypto.randomUUID()
  copy.name = makeUniqueName(namesOf(existing), intent.name)
  copy.createdAt = now
  copy.updatedAt = now
  for (const cond of copy.conditions) regenButtonIds(cond)
  return copy
}

/**
 * Extrai UMA condição para uma intenção NOVA (feature 3, a partir de uma condição-filha).
 * A meta (botId, categoria, prioridade, keywords, context) é herdada da intenção de
 * origem; a única condição é uma cópia fiel (botões regerados). ID e nome novos.
 */
export function intentFromCondition(intent: BotIntent, condIdx: number, existing: BotIntent[]): BotIntent | null {
  const cond = intent.conditions[condIdx]
  if (!cond) return null
  const now = new Date().toUTCString()
  return {
    id: crypto.randomUUID(),
    botId: intent.botId,
    name: makeUniqueName(namesOf(existing), intent.name),
    category: intent.category,
    keywords: [...(intent.keywords ?? [])],
    context: intent.context,
    priority: intent.priority,
    conditions: [cloneCondition(cond)],
    createdAt: now,
    updatedAt: now,
    advanced: intent.advanced ? { ...intent.advanced } : { active: false, endpointId: null },
  }
}
