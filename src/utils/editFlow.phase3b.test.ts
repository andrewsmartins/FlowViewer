import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { applyConnect, applyEdgeDelete, applyNodeDelete } from './editFlow'
import { addButton, removeButton, addButtonsMessage, updateCondition, addCondition, removeCondition, addButtonListMessage } from './editIntent'
import { createIntentTemplate } from './intentTemplates'
import { parseFlow } from './parseFlow'
import type { BotFlowJson, BotIntent } from '../types'

const samplesDir = join(dirname(fileURLToPath(import.meta.url)), '../../samples')
const BOT_ID = '8df3c1e7-a8c9-4bad-ac5a-2855462da840'

function loadSample(): BotFlowJson {
  return JSON.parse(readFileSync(join(samplesDir, 'sample01.json'), 'utf-8'))
}

function choiceFlow(): { json: BotFlowJson; choice: BotIntent; target: BotIntent } {
  const choice = createIntentTemplate('choiceNode', BOT_ID, 'menu')
  const target = createIntentTemplate('defaultNode', BOT_ID, 'destino')
  return { json: { list: [choice, target] }, choice, target }
}

describe('fluxo completo de escolhas: mensagem → botão → conectar → deletar', () => {
  it('cria mensagem de botões, adiciona botão e conecta preenchendo o slot', () => {
    const { json, choice, target } = choiceFlow()

    expect(addButtonsMessage(choice, 'Escolha uma opção:')).toEqual({ ok: true })
    expect(addButton(choice, 'Opção A', null)).toEqual({ ok: true })

    const cond = choice.conditions[0]
    expect(cond.action.choices).toEqual([''])

    const result = applyConnect(json, choice.id, target.id)
    expect(result).toEqual({ ok: true, kind: 'choice', condIdx: 0 })
    expect(cond.action.choices).toEqual([target.id])

    // A aresta renderiza com o label do botão
    const { edges } = parseFlow(json)
    expect(edges).toHaveLength(1)
    expect(edges[0].label).toBe('Opção A')
    expect(edges[0].id).toBe(`${choice.id}-c0-ch0`)
  })

  it('conecta opção LIVRE do menu criando um slot novo (modelo desacoplado 10c)', () => {
    const { json, choice, target } = choiceFlow()
    const target2 = createIntentTemplate('defaultNode', BOT_ID, 'destino2')
    json.list.push(target2)
    // Menu com 2 itens e NENHUMA escolha (choices vazio) → itens livres.
    addButtonListMessage(choice, {
      header: '', body: 'Escolha', footer: '', title: '', variant: 'plain',
      items: [{ text: 'A', description: '' }, { text: 'B', description: '' }],
    })
    expect(choice.conditions[0].action.choices).toEqual([])

    // 1ª conexão cria o slot da opção 0; a 2ª, da opção 1.
    expect(applyConnect(json, choice.id, target.id)).toEqual({ ok: true, kind: 'choice', condIdx: 0 })
    expect(choice.conditions[0].action.choices).toEqual([target.id])
    expect(applyConnect(json, choice.id, target2.id)).toEqual({ ok: true, kind: 'choice', condIdx: 0 })
    expect(choice.conditions[0].action.choices).toEqual([target.id, target2.id])

    // Sem mais itens livres (2 itens, 2 destinos) → falha.
    const target3 = createIntentTemplate('defaultNode', BOT_ID, 'destino3')
    json.list.push(target3)
    expect(applyConnect(json, choice.id, target3.id).ok).toBe(false)
  })

  it('preenche o slot vazio do MEIO antes de criar um novo', () => {
    const { json, choice, target } = choiceFlow()
    addButtonListMessage(choice, {
      header: '', body: 'm', footer: '', title: '', variant: 'plain',
      items: [{ text: 'A', description: '' }, { text: 'B', description: '' }, { text: 'C', description: '' }],
    })
    choice.conditions[0].action.choices = ['x', '', 'z'] // slot 1 vazio
    expect(applyConnect(json, choice.id, target.id)).toEqual({ ok: true, kind: 'choice', condIdx: 0 })
    expect(choice.conditions[0].action.choices).toEqual(['x', target.id, 'z'])
  })

  it('deletar aresta de escolha esvazia o slot mantendo o botão', () => {
    const { json, choice, target } = choiceFlow()
    addButtonsMessage(choice, 'menu')
    addButton(choice, 'Opção A', null)
    applyConnect(json, choice.id, target.id)

    expect(applyEdgeDelete(json, `${choice.id}-c0-ch0`)).toEqual({ ok: true })
    expect(choice.conditions[0].action.choices).toEqual([''])
    // botão preservado
    const buttons = choice.conditions[0].assistant_says[0].messages[0].messageConfig!.buttons
    expect(buttons).toHaveLength(1)
    expect(parseFlow(json).edges).toHaveLength(0)
  })

  it('removeButton remove botão e escolha na mesma posição', () => {
    const { json, choice, target } = choiceFlow()
    addButtonsMessage(choice, 'menu')
    addButton(choice, 'A', null)
    addButton(choice, 'B', null)
    applyConnect(json, choice.id, target.id) // preenche slot 0 (A)

    expect(removeButton(choice, 0)).toEqual({ ok: true })
    const buttons = choice.conditions[0].assistant_says[0].messages[0].messageConfig!.buttons
    expect(buttons.map(b => b.text)).toEqual(['B'])
    expect(choice.conditions[0].action.choices).toEqual([''])
  })

  it('addButton exige mensagem de botões; addButtonsMessage não duplica', () => {
    const { choice } = choiceFlow()
    expect(addButton(choice, 'X', null).ok).toBe(false)
    expect(addButtonsMessage(choice, 'menu')).toEqual({ ok: true })
    expect(addButtonsMessage(choice, 'outra').ok).toBe(false)
  })
})

describe('edição de condições', () => {
  it('atualiza, adiciona e remove condições', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(updateCondition(intent, 0, { name: 'tem cpf', type: 'exists', variable: 'customer.cpf', value: '' }))
      .toEqual({ ok: true })
    expect(intent.conditions[0]).toMatchObject({ name: 'tem cpf', type: 'exists', variable: 'customer.cpf', value: null })

    expect(addCondition(intent)).toEqual({ ok: true })
    expect(intent.conditions).toHaveLength(2)
    expect(intent.conditions[1].action.type).toBe('none')

    expect(removeCondition(intent, 0)).toEqual({ ok: true })
    expect(intent.conditions).toHaveLength(1)
  })

  it('não remove a última condição nem aceita nome vazio', () => {
    const intent = createIntentTemplate('defaultNode', BOT_ID, 'x')
    expect(removeCondition(intent, 0).ok).toBe(false)
    expect(updateCondition(intent, 0, { name: ' ', type: 'any', variable: '', value: '' }).ok).toBe(false)
  })
})

describe('applyConnect — origem por condição (Modelo B, Marco C)', () => {
  // Intenção com 2 condições não-choice (vira grupo: filhos {id}::c0 e {id}::c1).
  function multiCond(): { json: BotFlowJson; src: BotIntent; target: BotIntent } {
    const src = createIntentTemplate('defaultNode', BOT_ID, 'multi')
    addCondition(src) // agora 2 condições, ambas action.none, sem next
    const target = createIntentTemplate('defaultNode', BOT_ID, 'destino')
    return { json: { list: [src, target] }, src, target }
  }

  it('conecta a partir do filho {id}::c1 preenche o next DAQUELA condição', () => {
    const { json, src, target } = multiCond()
    const result = applyConnect(json, `${src.id}::c1`, target.id)
    expect(result).toEqual({ ok: true, kind: 'next', condIdx: 1 })
    // condição 0 permanece sem destino; só a 1 recebeu
    expect(src.conditions[0].next.intent).toBeUndefined()
    expect(src.conditions[1].next.intent).toEqual({ botId: BOT_ID, id: target.id })
  })

  it('conecta a partir do filho {id}::c0 não toca a condição 1', () => {
    const { json, src, target } = multiCond()
    applyConnect(json, `${src.id}::c0`, target.id)
    expect(src.conditions[0].next.intent).toEqual({ botId: BOT_ID, id: target.id })
    expect(src.conditions[1].next.intent).toBeUndefined()
  })

  it('condição já com destino recusa nova conexão (reconectar a aresta existente)', () => {
    const { json, src, target } = multiCond()
    applyConnect(json, `${src.id}::c0`, target.id)
    const again = applyConnect(json, `${src.id}::c0`, target.id)
    expect(again.ok).toBe(false)
  })

  it('filho de escolha sem itens no menu pede para criar itens', () => {
    const choice = createIntentTemplate('choiceNode', BOT_ID, 'menu')
    addCondition(choice) // c1 none; c0 é a choice, sem menu → nenhum item livre
    const target = createIntentTemplate('defaultNode', BOT_ID, 'd')
    const json = { list: [choice, target] }
    const r = applyConnect(json, `${choice.id}::c0`, target.id)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/menu|item|opç/)
  })

  it('condição inexistente no filho falha com mensagem clara', () => {
    const { json, src, target } = multiCond()
    const r = applyConnect(json, `${src.id}::c9`, target.id)
    expect(r.ok).toBe(false)
  })

  it('nó solto (ID cru) mantém o comportamento de primeira vaga livre', () => {
    const { json, src, target } = multiCond()
    const result = applyConnect(json, src.id, target.id)
    expect(result).toEqual({ ok: true, kind: 'next', condIdx: 0 }) // primeira vaga
  })
})

describe('applyNodeDelete', () => {
  it('remove a intenção e limpa next refs de entrada', () => {
    const json = loadSample()
    const { edges } = parseFlow(json)
    const targetEdge = edges.find(e => e.id.endsWith('-next'))!
    const victim = targetEdge.target

    const before = parseFlow(json).edges.filter(e => e.target === victim).length
    expect(before).toBeGreaterThan(0)

    expect(applyNodeDelete(json, victim)).toEqual({ ok: true })
    expect(json.list.some(i => i.id === victim)).toBe(false)

    // nenhuma referência interna restante para o excluído
    const dump = JSON.stringify(json)
    expect(dump.includes(`"id":"${victim}"`)).toBe(false)
    expect(parseFlow(json).edges.some(e => e.target === victim || e.source === victim)).toBe(false)
  })

  it('remove botão+escolha quando o nó deletado era destino de uma choice', () => {
    const { json, choice, target } = choiceFlow()
    addButtonsMessage(choice, 'menu')
    addButton(choice, 'A', null)
    applyConnect(json, choice.id, target.id)

    expect(applyNodeDelete(json, target.id)).toEqual({ ok: true })
    expect(choice.conditions[0].action.choices).toEqual([])
    expect(choice.conditions[0].assistant_says[0].messages[0].messageConfig!.buttons).toHaveLength(0)
  })

  it('reaponta error.next para o start quando apontava para o excluído', () => {
    const json = loadSample()
    const transfer = createIntentTemplate('transferNode', BOT_ID, 'transf')
    const victim = createIntentTemplate('defaultNode', BOT_ID, 'vitima')
    transfer.conditions[0].action.error!.next.intent = victim.id
    json.list.push(transfer, victim)

    expect(applyNodeDelete(json, victim.id)).toEqual({ ok: true })
    expect(transfer.conditions[0].action.error!.next.intent).toBe(`${BOT_ID}-start`)
  })

  it('bloqueia excluir o start e nós inexistentes', () => {
    const json = loadSample()
    const start = json.list.find(i => i.category === 'start')!
    expect(applyNodeDelete(json, start.id).ok).toBe(false)
    expect(applyNodeDelete(json, 'ext-qualquer').ok).toBe(false)
  })
})
