import { useState, useRef, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'

export interface Size { w: number; h: number }

/** Canto superior-direito fixo capturado no início da gesture (a âncora do resize). */
export interface Anchor { rightX: number; topY: number }

/**
 * Clampa o tamanho a partir da posição do cursor, com o canto superior-direito
 * (`anchor`) fixo — lógica PURA (sem DOM), testável isolada (decisão 6).
 * A alça está no canto inferior-esquerdo, então a largura cresce à medida que o
 * cursor vai p/ a esquerda (`rightX - mouse.x`) e a altura à medida que desce
 * (`mouse.y - topY`). Piso = `min`; teto = viewport (a borda esquerda não passa
 * de x=0 ⇒ `maxW = rightX`; a base não passa da viewport ⇒ `maxH = viewport.h - topY`).
 */
export function clampResize(
  mouse: { x: number; y: number },
  anchor: Anchor,
  min: Size,
  viewport: { w: number; h: number },
): Size {
  const maxW = anchor.rightX
  const maxH = viewport.h - anchor.topY
  return {
    w: Math.max(min.w, Math.min(maxW, anchor.rightX - mouse.x)),
    h: Math.max(min.h, Math.min(maxH, mouse.y - anchor.topY)),
  }
}

/**
 * Redimensionamento do widget do agente pela alça do canto INFERIOR-ESQUERDO,
 * mantendo o canto SUPERIOR-DIREITO fixo (redesign do widget, decisão 6).
 *
 * Compartilha o `ref` com o `useDraggable`: no mousedown mede o `getBoundingClientRect`
 * e congela (rightX, topY) — por isso funciona IGUAL no modo ancorado-por-CSS (`right-4`,
 * borda direita fixa de graça) e no modo arrastado-inline (`left/top`), sem saber em qual
 * está. A matemática do resize sai do rect, não do estado de posição.
 *
 * O tamanho é clampado a `[min, viewport]` (a borda esquerda não passa de x=0; a base
 * não passa da viewport). A escrita do tamanho — e, no modo arrastado, o recuo do `left`
 * p/ manter o canto direito fixo — é delegada ao `onResize` do dono do estado. Sem
 * dependências externas e sem persistência (decisão 7), no mesmo espírito do `useDraggable`.
 */
export function useResizable<T extends HTMLElement>(
  ref: RefObject<T>,
  min: Size,
  onResize: (size: Size, anchor: Anchor) => void,
) {
  const [resizing, setResizing] = useState(false)
  // Estado da gesture + callbacks FRESCOS num ref: os listeners de document são
  // registrados uma vez, então ler tudo por ref evita stale closure (mesmo padrão
  // do useDraggable). `min`/`onResize` são re-atribuídos a cada render.
  const g = useRef<{ active: boolean; anchor: Anchor; min: Size; onResize: typeof onResize }>({
    active: false,
    anchor: { rightX: 0, topY: 0 },
    min,
    onResize,
  })
  g.current.min = min
  g.current.onResize = onResize

  function onMouseDown(e: ReactMouseEvent) {
    if (e.button !== 0 || !ref.current) return
    // A alça não deve iniciar seleção de texto nem o drag do header (que sobe pelo bubbling).
    e.preventDefault()
    e.stopPropagation()
    const r = ref.current.getBoundingClientRect()
    g.current.active = true
    g.current.anchor = { rightX: r.right, topY: r.top }
    setResizing(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'nesw-resize'
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const s = g.current
      if (!s.active) return
      const size = clampResize(
        { x: e.clientX, y: e.clientY },
        s.anchor,
        s.min,
        { w: window.innerWidth, h: window.innerHeight },
      )
      s.onResize(size, s.anchor)
    }
    function onUp() {
      if (!g.current.active) return
      g.current.active = false
      setResizing(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return { onMouseDown, resizing }
}
