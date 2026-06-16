import { createContext, useContext } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/**
 * Ações/estado expostos pelo FlowCanvas às arestas customizadas. `onDeleteEdge`
 * faz o botão de remover cair no mesmo caminho de exclusão do App (patch no
 * modelo + histórico) sem passar callbacks pelo `data` da aresta; `isDark` deixa
 * a tag acompanhar o tema.
 */
export const EdgeActionsContext = createContext<{ onDeleteEdge: (edgeId: string) => void; isDark: boolean }>({
  onDeleteEdge: () => {},
  isDark: false,
})

/**
 * Aresta de fluxo (`-next` / escolha) com uma TAG no meio que reúne o rótulo da
 * conexão e o botão "×" de remover, num único elemento estilizado e elevado
 * acima das linhas (zIndex + fundo opaco) — antes a linha cobria o botão e
 * dificultava o clique. Forma descobrível de desfazer a ligação (o atalho Delete
 * continua valendo). Só as arestas deletáveis usam este tipo; externas e de
 * contexto seguem smoothstep simples (sem tag), pois não são removíveis aqui.
 */
export function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, label,
}: EdgeProps) {
  const { onDeleteEdge, isDark } = useContext(EdgeActionsContext)
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          data-edge-id={id}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            // Acima das linhas de conexão para não competir o clique com o path.
            zIndex: 10,
          }}
        >
          <div
            className={`flex items-center gap-0.5 rounded-full border shadow-sm py-0.5 ${label ? 'pl-2 pr-0.5' : 'px-0.5'} ${
              isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'
            }`}
          >
            {label && (
              <span className={`react-flow__edge-label text-[11px] leading-none whitespace-nowrap ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
                {label}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDeleteEdge(id) }}
              title="Remover conexão"
              aria-label="Remover conexão"
              className={`flex items-center justify-center w-[18px] h-[18px] rounded-full text-[13px] leading-none transition-colors ${
                isDark ? 'text-slate-400 hover:bg-rose-600 hover:text-white' : 'text-slate-400 hover:bg-rose-500 hover:text-white'
              }`}
            >×</button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
