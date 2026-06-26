import { describe, it, expect } from 'vitest'
import { chatGatePending } from './chatGate'

/**
 * Cobre os 4 estados do gate da caixinha (decisões 1 e 3 do PLANS §"Gate de
 * acesso à caixinha"). O caso "faltam os dois" prova o "individual" — a lista
 * traz cada pendente separado, em ordem estável (fluxo antes do token).
 */
describe('chatGatePending', () => {
  it('libera (lista vazia) quando há fluxo e token', () => {
    expect(chatGatePending(true, true)).toEqual([])
  })

  it('lista só o fluxo quando falta o fluxo', () => {
    expect(chatGatePending(false, true)).toEqual(['flow'])
  })

  it('lista só o token quando falta o token', () => {
    expect(chatGatePending(true, false)).toEqual(['token'])
  })

  it('lista os dois, em ordem estável, quando faltam ambos', () => {
    expect(chatGatePending(false, false)).toEqual(['flow', 'token'])
  })
})
