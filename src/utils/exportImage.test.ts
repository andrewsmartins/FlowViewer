import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { boundsNodes } from './exportImage'

/**
 * `boundsNodes` resolve o bug do export com grupos do Modelo B (Fase 6): o
 * `getNodesBounds` da @xyflow/system, chamado sem `nodeLookup`, lê a posição
 * CRUA dos nós. Filhos de um `intentGroupNode` têm posição relativa ao pai, que
 * seria tratada como absoluta → bounds/enquadramento errados. O container já
 * cobre os filhos, então eles são excluídos do cálculo.
 */
describe('boundsNodes (export com nós aninhados)', () => {
  const macro: Node = { id: 'g1', type: 'intentGroupNode', position: { x: 400, y: 300 }, data: {} }
  const child1: Node = { id: 'g1::c0', type: 'choiceNode', parentId: 'g1', position: { x: 14, y: 76 }, data: {} }
  const child2: Node = { id: 'g1::c1', type: 'captureNode', parentId: 'g1', position: { x: 274, y: 76 }, data: {} }
  const solo: Node = { id: 's1', type: 'defaultNode', position: { x: 900, y: 50 }, data: {} }

  it('exclui filhos (parentId) e mantém nós-macro', () => {
    const result = boundsNodes([macro, child1, child2, solo])
    expect(result.map(n => n.id)).toEqual(['g1', 's1'])
  })

  it('fluxo sem grupos não muda', () => {
    const flat = [solo, { ...macro, type: 'defaultNode' }]
    expect(boundsNodes(flat)).toHaveLength(2)
  })

  it('caminho infeliz: lista vazia retorna vazia', () => {
    expect(boundsNodes([])).toEqual([])
  })
})
