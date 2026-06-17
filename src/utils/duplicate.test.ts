import { describe, it, expect } from 'vitest'
import {
  regenButtonIds, cloneCondition, makeUniqueName,
  duplicateConditionInIntent, cloneIntent, intentFromCondition,
} from './duplicate'
import { createIntentTemplate } from './intentTemplates'
import { addButton, addButtonsMessage } from './editIntent'
import { validateFlow } from './validateFlow'
import type { BotIntent } from '../types'

const BOT_ID = '8df3c1e7-a8c9-4bad-ac5a-2855462da840'

/** Cria uma intenção de escolha com 2 botões + um next.intent apontando para `targetId`. */
function choiceWithButtons(targetId: string): BotIntent {
  const intent = createIntentTemplate('choiceNode', BOT_ID, 'menu')
  addButtonsMessage(intent, 'Escolha uma opção')
  addButton(intent, 'Opção A', null)
  addButton(intent, 'Opção B', null)
  // Aponta a 1ª escolha para um destino existente (ref de saída a preservar).
  intent.conditions[0].action.choices = [targetId, '']
  intent.conditions[0].next = { type: 'context', redirect: 'continueFlow', intent: { botId: BOT_ID, id: targetId } }
  return intent
}

function buttonIdsOf(intent: BotIntent): string[] {
  return intent.conditions.flatMap(c =>
    c.assistant_says.flatMap(s => s.messages.flatMap(m => m.messageConfig?.buttons?.map(b => b.id) ?? [])))
}

describe('regenButtonIds', () => {
  it('troca todos os ids de botão e preserva texto e choices', () => {
    const intent = choiceWithButtons('dest-1')
    const before = buttonIdsOf(intent)
    const beforeChoices = [...(intent.conditions[0].action.choices as string[])]
    regenButtonIds(intent.conditions[0])
    const after = buttonIdsOf(intent)
    expect(after).toHaveLength(before.length)
    after.forEach((id, i) => expect(id).not.toBe(before[i]))
    // choices guardam IDs de intenção, não de botão — intactas.
    expect(intent.conditions[0].action.choices).toEqual(beforeChoices)
  })
})

describe('cloneCondition', () => {
  it('copia profundamente, regera ids de botão e preserva next/choices', () => {
    const intent = choiceWithButtons('dest-1')
    const orig = intent.conditions[0]
    const copy = cloneCondition(orig)
    // refs de saída preservadas
    expect(copy.next).toEqual(orig.next)
    expect(copy.action.choices).toEqual(orig.action.choices)
    // ids de botão diferentes do original
    const origIds = orig.assistant_says.flatMap(s => s.messages.flatMap(m => m.messageConfig?.buttons?.map(b => b.id) ?? []))
    const copyIds = copy.assistant_says.flatMap(s => s.messages.flatMap(m => m.messageConfig?.buttons?.map(b => b.id) ?? []))
    copyIds.forEach((id, i) => expect(id).not.toBe(origIds[i]))
    // cópia profunda — mexer na cópia não afeta o original
    copy.name = 'mudou'
    expect(orig.name).not.toBe('mudou')
  })
})

describe('makeUniqueName', () => {
  it('sufixa _copia e depois _copia_N até não colidir', () => {
    expect(makeUniqueName(new Set(), 'menu')).toBe('menu_copia')
    expect(makeUniqueName(new Set(['menu_copia']), 'menu')).toBe('menu_copia_2')
    expect(makeUniqueName(new Set(['menu_copia', 'menu_copia_2']), 'menu')).toBe('menu_copia_3')
  })
})

describe('duplicateConditionInIntent', () => {
  it('adiciona uma cópia da condição na MESMA intenção (solto vira grupo)', () => {
    const intent = choiceWithButtons('dest-1')
    expect(intent.conditions).toHaveLength(1)
    const result = duplicateConditionInIntent(intent, 0)
    expect(result).toEqual({ ok: true })
    expect(intent.conditions).toHaveLength(2)
    // a nova condição é cópia fiel, mas com ids de botão próprios
    const ids0 = intent.conditions[0].assistant_says.flatMap(s => s.messages.flatMap(m => m.messageConfig?.buttons?.map(b => b.id) ?? []))
    const ids1 = intent.conditions[1].assistant_says.flatMap(s => s.messages.flatMap(m => m.messageConfig?.buttons?.map(b => b.id) ?? []))
    expect(ids1).toHaveLength(ids0.length)
    ids1.forEach(id => expect(ids0).not.toContain(id))
  })

  it('caminho infeliz: condIdx fora do range não altera nada', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    const result = duplicateConditionInIntent(intent, 5)
    expect(result.ok).toBe(false)
    expect(intent.conditions).toHaveLength(1)
  })
})

describe('cloneIntent', () => {
  it('gera id/nome/timestamps novos, regera botões e preserva refs de saída', () => {
    const intent = choiceWithButtons('dest-1')
    const list = [intent]
    const copy = cloneIntent(intent, list)
    expect(copy.id).not.toBe(intent.id)
    expect(copy.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(copy.name).toBe('menu_copia')
    expect(copy.createdAt).toBeTruthy()
    // ref de saída preservada (a cópia continua o fluxo para o mesmo destino)
    const next = copy.conditions[0].next.intent
    expect(typeof next === 'object' && next.id).toBe('dest-1')
    expect(copy.conditions[0].action.choices).toEqual(['dest-1', ''])
    // botões regerados (sem colisão com o original)
    const origIds = buttonIdsOf(intent)
    const copyIds = buttonIdsOf(copy)
    copyIds.forEach(id => expect(origIds).not.toContain(id))
  })

  it('a cópia não compartilha referências com o original (deep clone)', () => {
    const intent = choiceWithButtons('dest-1')
    const copy = cloneIntent(intent, [intent])
    copy.conditions[0].name = 'alterada'
    expect(intent.conditions[0].name).not.toBe('alterada')
  })

  it('cópia + original passam na validação sem ID duplicado', () => {
    const intent = choiceWithButtons('dest-1')
    const target = createIntentTemplate('defaultNode', BOT_ID, 'dest')
    target.id = 'dest-1'
    const start = createIntentTemplate('defaultNode', BOT_ID, 'start')
    start.category = 'start'
    const list = [start, intent, target]
    const copy = cloneIntent(intent, list)
    list.push(copy)
    const report = validateFlow({ list })
    expect(report.errors).toHaveLength(0)
  })
})

describe('intentFromCondition', () => {
  it('cria intenção nova com UMA condição e meta herdada', () => {
    const intent = choiceWithButtons('dest-1')
    intent.priority = 0.5
    intent.keywords = ['oi', 'menu']
    intent.conditions.push(createIntentTemplate('captureNode', BOT_ID, 'tmp').conditions[0])
    const copy = intentFromCondition(intent, 1, [intent])
    expect(copy).not.toBeNull()
    expect(copy!.conditions).toHaveLength(1)
    expect(copy!.conditions[0].action.type).toBe('captureData')
    expect(copy!.id).not.toBe(intent.id)
    expect(copy!.priority).toBe(0.5)
    expect(copy!.keywords).toEqual(['oi', 'menu'])
    expect(copy!.botId).toBe(BOT_ID)
  })

  it('caminho infeliz: condIdx inexistente devolve null', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(intentFromCondition(intent, 9, [intent])).toBeNull()
  })
})
