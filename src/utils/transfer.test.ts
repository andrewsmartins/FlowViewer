import { describe, it, expect } from 'vitest'
import {
  resolveTransferType, transferFieldOf, TRANSFER_MAP, TRANSFER_CATEGORY_VALUES,
} from './transfer'

/**
 * Testes da FONTE ÚNICA de Transferência (v0.35.0). `resolveTransferType` é o núcleo que o
 * `set_transfer` usa para virar categoria+sub no `transferType` canônico (1 dos 6) — matando
 * o "team" inventado. Cobre o acoplamento categoria↔sub↔campo e os caminhos infelizes.
 */
describe('resolveTransferType — (categoria, sub) → transferType válido', () => {
  it('group + simple → direct4group (campo teamPicker)', () => {
    expect(resolveTransferType('group', 'simple')).toEqual({
      ok: true, transferType: 'direct4group', field: 'teamPicker',
    })
  })

  it('group + advanced → search4group (campo variable)', () => {
    expect(resolveTransferType('group', 'advanced')).toEqual({
      ok: true, transferType: 'search4group', field: 'variable',
    })
  })

  it('user + name → direct4user (campo userPicker)', () => {
    expect(resolveTransferType('user', 'name')).toEqual({
      ok: true, transferType: 'direct4user', field: 'userPicker',
    })
  })

  it('user + email → search4user (campo variable)', () => {
    expect(resolveTransferType('user', 'email')).toEqual({
      ok: true, transferType: 'search4user', field: 'variable',
    })
  })

  it('userPrevious (sem sub) → direct4userPrevious (campo none)', () => {
    expect(resolveTransferType('userPrevious')).toEqual({
      ok: true, transferType: 'direct4userPrevious', field: 'none',
    })
  })

  it('branch (sem sub) → directFromBranch (campo none)', () => {
    expect(resolveTransferType('branch')).toEqual({
      ok: true, transferType: 'directFromBranch', field: 'none',
    })
  })

  it('sub extra numa categoria sem nível 2 é ignorado (não é erro)', () => {
    expect(resolveTransferType('branch', 'qualquer')).toEqual({
      ok: true, transferType: 'directFromBranch', field: 'none',
    })
  })

  it('normaliza sub com espaço/caixa (texto livre da tool) → resolve', () => {
    expect(resolveTransferType('group', ' Simple ')).toEqual({
      ok: true, transferType: 'direct4group', field: 'teamPicker',
    })
    expect(resolveTransferType('user', 'EMAIL')).toEqual({
      ok: true, transferType: 'search4user', field: 'variable',
    })
  })

  it('categoria user SEM sub → erro (exige a sub-opção)', () => {
    const r = resolveTransferType('user')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/exige uma sub-opção/)
  })

  it('sub inválida para a categoria → erro listando as válidas', () => {
    const r = resolveTransferType('group', 'inexistente')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/sub-opção inválida.*simple.*advanced/)
  })

  it('categoria inválida (ex.: "team" inventado) → erro listando as válidas', () => {
    const r = resolveTransferType('team')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toMatch(/categoria de transferência inválida/)
      expect(r.reason).toContain('group')
    }
  })

  it('cobre exatamente os 6 tipos da plataforma (fonte única)', () => {
    expect(Object.keys(TRANSFER_MAP).sort()).toEqual([
      'direct4group', 'direct4user', 'direct4userPrevious',
      'directFromBranch', 'search4group', 'search4user',
    ])
    expect([...TRANSFER_CATEGORY_VALUES]).toEqual(['userPrevious', 'branch', 'user', 'group'])
  })

  it('transferFieldOf devolve "none" para tipo legado/desconhecido', () => {
    expect(transferFieldOf('team')).toBe('none')
    expect(transferFieldOf('direct4group')).toBe('teamPicker')
  })
})
