import type { BotIntent, BotMessage, BulkUpdateItem } from '../types'
import type { EditResult } from './editFlow'

/**
 * Patches de CONTEÚDO de uma intenção (Fase 3): mensagens, botões, metadados
 * e campos da ação. Todas as funções mutam o intent do modelo em memória
 * (estratégia preserve-and-patch) e atualizam `updatedAt`.
 */

/** Endereço estável de uma mensagem dentro da intenção. */
export interface MessageRef {
  condIdx: number
  sayIdx: number
  msgIdx: number
}

export interface EditableMessage {
  ref: MessageRef
  type: string
  /** Texto exibível: content (TEXT) ou messageConfig.body (BUTTON/LIST). */
  text: string
}

function touch(intent: BotIntent): void {
  intent.updatedAt = new Date().toUTCString()
}

function getMessage(intent: BotIntent, ref: MessageRef): BotMessage | null {
  return intent.conditions[ref.condIdx]?.assistant_says[ref.sayIdx]?.messages[ref.msgIdx] ?? null
}

/** Lista todas as mensagens da intenção com seus endereços, na ordem de exibição. */
export function listMessages(intent: BotIntent): EditableMessage[] {
  const result: EditableMessage[] = []
  intent.conditions.forEach((cond, condIdx) => {
    cond.assistant_says.forEach((say, sayIdx) => {
      say.messages.forEach((msg, msgIdx) => {
        const text = msg.type === 'TEXT' ? msg.content ?? '' : msg.messageConfig?.body ?? ''
        result.push({ ref: { condIdx, sayIdx, msgIdx }, type: msg.type, text })
      })
    })
  })
  return result
}

/** Atualiza o texto de uma mensagem (content para TEXT, body para BUTTON/LIST). */
export function updateMessageText(intent: BotIntent, ref: MessageRef, text: string): EditResult {
  const msg = getMessage(intent, ref)
  if (!msg) return { ok: false, reason: 'mensagem não encontrada na intenção' }
  if (msg.type === 'TEXT') {
    msg.content = text
  } else if (msg.messageConfig) {
    msg.messageConfig.body = text
  } else {
    return { ok: false, reason: `mensagem do tipo ${msg.type} não tem texto editável` }
  }
  touch(intent)
  return { ok: true }
}

/** Acrescenta uma mensagem TEXT ao final da primeira condição da intenção. */
export function addTextMessage(intent: BotIntent, text: string): EditResult {
  const cond = intent.conditions[0]
  if (!cond) return { ok: false, reason: 'intenção sem condições' }
  if (!cond.assistant_says.length) cond.assistant_says.push({ channel: 'any', messages: [] })
  cond.assistant_says[0].messages.push({ type: 'TEXT', content: text, fileName: '' })
  touch(intent)
  return { ok: true }
}

/**
 * Remove uma mensagem TEXT. Mensagens BUTTON/LIST não são removíveis aqui:
 * os botões mapeiam posicionalmente para action.choices e ficariam órfãos.
 */
export function removeMessage(intent: BotIntent, ref: MessageRef): EditResult {
  const msg = getMessage(intent, ref)
  if (!msg) return { ok: false, reason: 'mensagem não encontrada na intenção' }
  if (msg.type !== 'TEXT') {
    return { ok: false, reason: `mensagens do tipo ${msg.type} não podem ser removidas (os botões mapeiam para as escolhas)` }
  }
  intent.conditions[ref.condIdx].assistant_says[ref.sayIdx].messages.splice(ref.msgIdx, 1)
  touch(intent)
  return { ok: true }
}

/** Atualiza texto/descrição de um botão (BUTTON/LIST) pelo índice exibido. */
export function updateButton(intent: BotIntent, btnIdx: number, text: string, description: string | null): EditResult {
  for (const cond of intent.conditions) {
    for (const say of cond.assistant_says) {
      for (const msg of say.messages) {
        const btn = msg.messageConfig?.buttons?.[btnIdx]
        if ((msg.type === 'BUTTON' || msg.type === 'LIST') && btn) {
          btn.text = text
          btn.description = description || null
          touch(intent)
          return { ok: true }
        }
      }
    }
  }
  return { ok: false, reason: 'botão não encontrado na intenção' }
}

/** Atualiza nome, categoria e keywords da intenção. */
export function updateIntentMeta(
  intent: BotIntent,
  meta: { name: string; category: string; keywords: string[] },
): EditResult {
  if (!meta.name.trim()) return { ok: false, reason: 'o nome da intenção não pode ficar vazio' }
  intent.name = meta.name.trim()
  intent.category = meta.category.trim() || 'Sem Categoria'
  intent.keywords = meta.keywords.map(k => k.trim()).filter(Boolean)
  touch(intent)
  return { ok: true }
}

/**
 * Atualiza campos da ação na primeira condição cujo action.type seja o
 * informado (transfer → transferType/value; captureData → captureDataType/variable).
 */
export function updateActionFields(
  intent: BotIntent,
  actionType: string,
  fields: Partial<{ transferType: string; value: string; captureDataType: string; variable: string }>,
): EditResult {
  const cond = intent.conditions.find(c => c.action.type === actionType)
  if (!cond) return { ok: false, reason: `a intenção não tem ação do tipo ${actionType}` }
  if (fields.transferType !== undefined) cond.action.transferType = fields.transferType || null
  if (fields.value !== undefined) cond.action.value = fields.value || null
  if (fields.captureDataType !== undefined) cond.action.captureDataType = fields.captureDataType || null
  if (fields.variable !== undefined) cond.action.variable = fields.variable || null
  touch(intent)
  return { ok: true }
}

/** Substitui as variáveis definidas (bulkUpdate) da condição setData. */
export function updateSetDataItems(intent: BotIntent, items: BulkUpdateItem[]): EditResult {
  const cond = intent.conditions.find(c => c.action.type === 'setData')
  if (!cond) return { ok: false, reason: 'a intenção não tem ação setData' }
  const cleaned = items
    .map(i => ({ variable: i.variable.trim(), value: i.value }))
    .filter(i => i.variable)
  cond.action.bulkUpdate = cleaned
  touch(intent)
  return { ok: true }
}
