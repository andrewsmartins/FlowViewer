import { useState, useRef, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

interface Pos { x: number; y: number }

/**
 * Hook de drag-and-drop nativo para o widget flutuante da caixinha de chat.
 * Sem dependências externas (decisão 2 do PLANS §"Chat UX").
 *
 * Retorna um `ref` para o elemento arrastável, um `style` com `top/left`
 * quando arrastado (undefined = usa o posicionamento CSS padrão do elemento),
 * `onMouseDown` para o handle de drag, e `wasDragged()` para suprimir onClick
 * quando o mouseup encerra um drag (não um clique simples).
 *
 * Clamp dentro da viewport; sem snapping (decisão 3). Posição só em memória,
 * sem localStorage (decisão 4).
 */
export function useDraggable<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [pos, setPos] = useState<Pos | null>(null)
  const drag = useRef({ active: false, wasDrag: false, ox: 0, oy: 0, sx: 0, sy: 0 })

  function onMouseDown(e: ReactMouseEvent) {
    if (e.button !== 0 || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    drag.current = { active: true, wasDrag: false, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = drag.current
      if (!d.active || !ref.current) return
      if (!d.wasDrag && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
      if (!d.wasDrag) { d.wasDrag = true; document.body.style.userSelect = 'none' }
      const { offsetWidth: w, offsetHeight: h } = ref.current
      setPos({
        x: Math.max(0, Math.min(e.clientX - d.ox, window.innerWidth - w)),
        y: Math.max(0, Math.min(e.clientY - d.oy, window.innerHeight - h)),
      })
    }
    function onUp() {
      drag.current.active = false
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return {
    ref,
    style: pos ? { top: pos.y, left: pos.x, right: 'auto' as const, bottom: 'auto' as const } : undefined,
    onMouseDown,
    wasDragged: () => drag.current.wasDrag,
  }
}
