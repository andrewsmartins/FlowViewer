import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import {
  listMessages, updateMessageText, addTextMessage, removeMessage,
  updateButton, updateIntentMeta, updateActionFields, updateSetDataItems,
  addCondition,
} from './editIntent'
import { validateFlow } from './validateFlow'
import { createIntentTemplate } from './intentTemplates'
import type { BotFlowJson, BotIntent } from '../types'

const samplesDir = join(dirname(fileURLToPath(import.meta.url)), '../../samples')
const BOT_ID = '8df3c1e7-a8c9-4bad-ac5a-2855462da840'

function loadSample(): BotFlowJson {
  return JSON.parse(readFileSync(join(samplesDir, 'sample01.json'), 'utf-8'))
}

function intentWithButtons(json: BotFlowJson): BotIntent {
  const intent = json.list.find(i =>
    i.conditions.some(c => c.assistant_says.some(s => s.messages.some(m => m.messageConfig?.buttons?.length))))
  if (!intent) throw new Error('sample01 sem intenção com botões')
  return intent
}

describe('listMessages / updateMessageText', () => {
  it('lista mensagens com endereços válidos e edita pelo endereço', () => {
    const json = loadSample()
    const intent = json.list.find(i => listMessages(i).length > 0)!
    const msgs = listMessages(intent)
    expect(msgs.length).toBeGreaterThan(0)

    const result = updateMessageText(intent, msgs[0].ref, 'texto editado')
    expect(result).toEqual({ ok: true })
    expect(listMessages(intent)[0].text).toBe('texto editado')
  })

  it('edita o body de mensagens BUTTON/LIST', () => {
    const intent = intentWithButtons(loadSample())
    const btnMsg = listMessages(intent).find(m => m.type === 'BUTTON' || m.type === 'LIST')!
    expect(updateMessageText(intent, btnMsg.ref, 'novo corpo')).toEqual({ ok: true })
    expect(listMessages(intent).find(m => m.ref.condIdx === btnMsg.ref.condIdx && m.ref.msgIdx === btnMsg.ref.msgIdx)?.text).toBe('novo corpo')
  })

  it('rejeita endereço inexistente sem alterar nada', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(updateMessageText(intent, { condIdx: 0, sayIdx: 0, msgIdx: 5 }, 'y').ok).toBe(false)
  })
})

describe('addTextMessage / removeMessage', () => {
  it('adiciona TEXT em template recém-criado e remove em seguida', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(addTextMessage(intent, 'olá!')).toEqual({ ok: true })
    const msgs = listMessages(intent)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].text).toBe('olá!')

    expect(removeMessage(intent, msgs[0].ref)).toEqual({ ok: true })
    expect(listMessages(intent)).toHaveLength(0)
  })

  it('não remove mensagens BUTTON/LIST (escolhas ficariam órfãs)', () => {
    const intent = intentWithButtons(loadSample())
    const btnMsg = listMessages(intent).find(m => m.type === 'BUTTON' || m.type === 'LIST')!
    const result = removeMessage(intent, btnMsg.ref)
    expect(result.ok).toBe(false)
  })
})

describe('updateButton', () => {
  it('altera texto e descrição preservando o id do botão', () => {
    const intent = intentWithButtons(loadSample())
    const before = intent.conditions
      .flatMap(c => c.assistant_says).flatMap(s => s.messages)
      .find(m => m.messageConfig?.buttons?.length)!.messageConfig!.buttons
    const originalId = before[0].id

    expect(updateButton(intent, 0, 'Novo rótulo', 'desc')).toEqual({ ok: true })
    expect(before[0]).toEqual({ id: originalId, text: 'Novo rótulo', description: 'desc' })
  })

  it('rejeita índice fora do alcance', () => {
    const intent = intentWithButtons(loadSample())
    expect(updateButton(intent, 99, 'x', null).ok).toBe(false)
  })
})

describe('updateIntentMeta', () => {
  it('atualiza nome/categoria/keywords e o updatedAt', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'antigo')
    intent.updatedAt = 'Mon, 01 Jan 2024 00:00:00 GMT'
    const result = updateIntentMeta(intent, { name: ' novo_nome ', category: '', keywords: ['a', ' b ', ''] })
    expect(result).toEqual({ ok: true })
    expect(intent.name).toBe('novo_nome')
    expect(intent.category).toBe('Sem Categoria')
    expect(intent.keywords).toEqual(['a', 'b'])
    expect(intent.updatedAt).not.toBe('Mon, 01 Jan 2024 00:00:00 GMT')
  })

  it('rejeita nome vazio', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(updateIntentMeta(intent, { name: '  ', category: 'c', keywords: [] }).ok).toBe(false)
    expect(intent.name).toBe('x')
  })

  it('atualiza priority e context (Modelo B); context vazio vira null', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    updateIntentMeta(intent, { name: 'x', category: 'c', keywords: [], priority: 0.75, context: ' menu-id ' })
    expect(intent.priority).toBe(0.75)
    expect(intent.context).toBe('menu-id')
    updateIntentMeta(intent, { name: 'x', category: 'c', keywords: [], context: '' })
    expect(intent.context).toBeNull()
  })

  it('não mexe em priority/context quando os campos são omitidos', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    intent.priority = 0.5
    intent.context = 'algo'
    updateIntentMeta(intent, { name: 'x', category: 'c', keywords: [] })
    expect(intent.priority).toBe(0.5)
    expect(intent.context).toBe('algo')
  })
})

describe('edição escopada por condição (Modelo B, Marco C)', () => {
  // Intenção com 2 condições: c0 = transfer, c1 = captureData.
  function twoActionCond(): BotIntent {
    const intent = createIntentTemplate('transferNode', BOT_ID, 'multi')
    addCondition(intent)
    intent.conditions[1].action = { ...intent.conditions[0].action, type: 'captureData', transferType: null, value: null }
    return intent
  }

  it('updateActionFields com condIdx mira AQUELA condição', () => {
    const intent = twoActionCond()
    // a condição 1 é captureData; sem condIdx, "transfer" acharia a c0
    expect(updateActionFields(intent, 'captureData', { captureDataType: 'cpf', variable: 'c.cpf' }, 1)).toEqual({ ok: true })
    expect(intent.conditions[1].action.captureDataType).toBe('cpf')
    expect(intent.conditions[0].action.captureDataType).toBeNull()
  })

  it('addTextMessage com condIdx cai na condição certa', () => {
    const intent = twoActionCond()
    addTextMessage(intent, 'oi da c1', 1)
    const c1msgs = listMessages(intent).filter(m => m.ref.condIdx === 1)
    expect(c1msgs.some(m => m.text === 'oi da c1')).toBe(true)
    expect(listMessages(intent).filter(m => m.ref.condIdx === 0).some(m => m.text === 'oi da c1')).toBe(false)
  })

  it('updateButton com condIdx só procura na condição informada', () => {
    const intent = createIntentTemplate('choiceNode', BOT_ID, 'menu')
    addCondition(intent) // c1 sem botões
    // c0 é choice mas ainda sem mensagem de botões → updateButton(0) não acha
    expect(updateButton(intent, 0, 'X', null, 1).ok).toBe(false) // c1 não tem botões
  })
})

describe('updateActionFields / updateSetDataItems', () => {
  it('atualiza transferType e value na condição transfer', () => {
    const intent = createIntentTemplate('transferNode', BOT_ID, 'x')
    expect(updateActionFields(intent, 'transfer', { transferType: 'search4group', value: 'GRP123' })).toEqual({ ok: true })
    const action = intent.conditions[0].action
    expect(action.transferType).toBe('search4group')
    expect(action.value).toBe('GRP123')
  })

  it('atualiza captureDataType e variable na condição captureData', () => {
    const intent = createIntentTemplate('captureNode', BOT_ID, 'x')
    expect(updateActionFields(intent, 'captureData', { captureDataType: 'cpf', variable: 'customer.cpf' })).toEqual({ ok: true })
    expect(intent.conditions[0].action.captureDataType).toBe('cpf')
    expect(intent.conditions[0].action.variable).toBe('customer.cpf')
  })

  it('rejeita tipo de ação que a intenção não tem', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(updateActionFields(intent, 'transfer', { value: 'y' }).ok).toBe(false)
  })

  it('substitui bulkUpdate filtrando variáveis vazias', () => {
    const intent = createIntentTemplate('setDataNode', BOT_ID, 'x')
    const result = updateSetDataItems(intent, [
      { variable: ' var1 ', value: 'a' },
      { variable: '', value: 'descartado' },
    ])
    expect(result).toEqual({ ok: true })
    expect(intent.conditions[0].action.bulkUpdate).toEqual([{ variable: 'var1', value: 'a' }])
  })
})

describe('validateFlow', () => {
  it('sample01 passa sem erros', () => {
    const report = validateFlow(loadSample())
    expect(report.errors).toEqual([])
  })

  it('detecta ID duplicado como erro', () => {
    const json = loadSample()
    json.list.push({ ...json.list[0] })
    expect(validateFlow(json).errors.some(e => e.includes('ID duplicado'))).toBe(true)
  })

  it('detecta intenção sem nome e sem condições como erro', () => {
    const a = createIntentTemplate('defaultNode', BOT_ID, 'x')
    a.name = ''
    const b = createIntentTemplate('defaultNode', BOT_ID, 'y')
    b.conditions = []
    const report = validateFlow({ list: [a, b] })
    expect(report.errors).toHaveLength(2)
  })

  it('referência interna quebrada vira erro bloqueante (a plataforma a trata como erro a preencher)', () => {
    const json = loadSample()
    const cond = json.list.flatMap(i => i.conditions).find(c => c.next?.intent && typeof c.next.intent === 'object')!
    ;(cond.next.intent as { id: string }).id = 'id-que-nao-existe'
    const report = validateFlow(json)
    expect(report.errors.some(e => e.includes('inexistente'))).toBe(true)
    expect(report.warnings.some(w => w.includes('inexistente'))).toBe(false)
  })

  it('fluxo sem start gera aviso', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    const report = validateFlow({ list: [intent] })
    expect(report.warnings.some(w => w.includes('início'))).toBe(true)
  })

  it('lista vazia não quebra', () => {
    const report = validateFlow({ list: [] })
    expect(report.errors).toEqual([])
  })
})
