import { describe, it, expect } from 'vitest'
import { clampResize, type Anchor, type Size } from './useResizable'

/**
 * Lógica pura do resize do widget (decisão 6): a alça no canto inferior-esquerdo
 * cresce a janela mantendo o canto superior-direito (`anchor`) fixo, clampando ao
 * piso (`min`) e à viewport. Testado sem DOM.
 */
describe('clampResize', () => {
  // Cenário base: painel ancorado no topo-direito de uma viewport 1280×800,
  // com a margem `right-4/top-4` (16px). Canto sup-direito em (1264, 16).
  const anchor: Anchor = { rightX: 1264, topY: 16 }
  const min: Size = { w: 400, h: 600 }
  const viewport = { w: 1280, h: 800 }

  it('cresce ao arrastar a alça p/ esquerda e p/ baixo', () => {
    // Cursor em (700, 700): w = 1264-700 = 564; h = 700-16 = 684.
    expect(clampResize({ x: 700, y: 700 }, anchor, min, viewport)).toEqual({ w: 564, h: 684 })
  })

  it('nunca encolhe abaixo do piso (mín = default)', () => {
    // Cursor perto do canto → tamanho abaixo do mín → clampa no piso 400×600.
    expect(clampResize({ x: 1200, y: 100 }, anchor, min, viewport)).toEqual({ w: 400, h: 600 })
  })

  it('a largura não passa da borda esquerda da viewport (x=0 ⇒ maxW=rightX)', () => {
    // Cursor além da borda esquerda (x negativo) → largura satura em rightX.
    expect(clampResize({ x: -50, y: 700 }, anchor, min, viewport).w).toBe(1264)
  })

  it('a altura não passa da base da viewport (maxH = viewport.h - topY)', () => {
    // Cursor abaixo da viewport → altura satura em 800-16 = 784.
    expect(clampResize({ x: 700, y: 9999 }, anchor, min, viewport).h).toBe(784)
  })

  it('mantém o canto superior-direito fixo: newLeft = rightX - w', () => {
    // No modo arrastado o ChatPanel recua o left por rightX - w; conferimos a
    // invariante do canto direito (left + w === rightX) p/ um tamanho qualquer.
    const size = clampResize({ x: 500, y: 500 }, anchor, min, viewport)
    const newLeft = anchor.rightX - size.w
    expect(newLeft + size.w).toBe(anchor.rightX)
    expect(newLeft).toBe(500) // = clientX quando não clampado
  })

  it('respeita um piso menor em viewport estreita (default clampado)', () => {
    // Em telas pequenas o piso vem de computePanelSize (< 400×600); aqui simulamos
    // min 300×480 e conferimos que o clamp usa esse piso, não um 400×600 fixo.
    const smallMin: Size = { w: 300, h: 480 }
    expect(clampResize({ x: 1200, y: 100 }, anchor, smallMin, viewport)).toEqual({ w: 300, h: 480 })
  })
})
