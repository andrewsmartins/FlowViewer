import { describe, it, expect } from 'vitest'
import { VARIABLE_GROUPS, variableDisplay } from './variables'

describe('VARIABLE_GROUPS — catálogo de variáveis', () => {
  const groups = Object.fromEntries(VARIABLE_GROUPS.map(g => [g.key, g]))

  it('tem as categorias esperadas com rótulos amigáveis', () => {
    expect(groups.customer.label).toBe('Consumidor')
    expect(groups.channel.label).toBe('Canal')
    expect(groups.chat.label).toBe('Chat')
    expect(groups.custom.label).toBe('Personalizado')
    expect(groups.team.label).toBe('Time')
    expect(groups.flow.label).toBe('Flow')
    expect(groups.entity.label).toBe('Lista')
  })

  it('namespaces "pelados" são categorias-folha com valor prefixo', () => {
    for (const key of ['entity', 'api', 'custom', 'team', 'flow']) {
      expect(groups[key].value).toBe(`@${key}`)
      expect(groups[key].items).toBeUndefined()
    }
  })

  it('horário do bot gera 14 itens (2 campos × 7 dias), cada um com 2 modificadores', () => {
    const schedule = groups.bot.items!.filter(i => i.value.includes('Time.'))
    expect(schedule).toHaveLength(14)
    const monday = schedule.find(i => i.value === '@bot.openingTime.monday')
    expect(monday?.modifiers?.map(m => m.suffix)).toEqual(['#getHourOfDate', '#getHoursAndMinutesOfDate'])
  })

  it('variáveis com escolha real têm modifiers; combinação única não', () => {
    const number = groups.store.items!.find(i => i.value === '@store.number')
    expect(number?.modifiers?.map(m => m.suffix)).toEqual(['#onlyNumbers', '#normalizeQuery'])
    // birthDate inclui a opção "sem modificador" (suffix vazio)
    const birth = groups.customer.items!.find(i => i.value === '@customer.birthDate')
    expect(birth?.modifiers?.some(m => m.suffix === '')).toBe(true)
    // Nome tem combinação única → modificador embutido, sem etapa
    const name = groups.customer.items!.find(i => i.label === 'Nome')
    expect(name?.value).toBe('@customer.name#normalizeQuery')
    expect(name?.modifiers).toBeUndefined()
  })

  it('campo personalizado é um item prefixo (ID por-conta completado à mão)', () => {
    const custom = groups.customer.items!.find(i => i.value === '@customer.customFields.')
    expect(custom?.prefix).toBe(true)
  })
})

describe('variableDisplay', () => {
  it('resolve item de combinação única para "Categoria › Item"', () => {
    expect(variableDisplay('@customer.name#normalizeQuery')).toEqual({ label: 'Consumidor › Nome', resolved: true })
    expect(variableDisplay('@store.zip#zipcode')).toEqual({ label: 'Loja › CEP', resolved: true })
  })

  it('resolve item com modificador para "Categoria › Item (Modificador)"', () => {
    expect(variableDisplay('@store.number#onlyNumbers')).toEqual({ label: 'Loja › Número (Só dígitos)', resolved: true })
    expect(variableDisplay('@bot.openingTime.monday#getHourOfDate')).toEqual({ label: 'Bot › Abertura segunda (Hora)', resolved: true })
  })

  it('modificador vazio (sem modificador) não adiciona parênteses', () => {
    expect(variableDisplay('@customer.birthDate')).toEqual({ label: 'Consumidor › Data de nascimento', resolved: true })
  })

  it('valor não-catalogado (prefixo completado/custom) cai no cru, não resolvido', () => {
    expect(variableDisplay('@customer.customFields.hBhq2eAiWX')).toEqual({ label: '@customer.customFields.hBhq2eAiWX', resolved: false })
    expect(variableDisplay('')).toEqual({ label: '', resolved: false })
  })
})
