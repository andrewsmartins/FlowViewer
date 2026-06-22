import type { FlowNodeData } from '../../types'
import { NodeShell, NodePreview, NodePill, NodeNote } from './NodeShell'
import { listIcon } from './nodeIcons'
import { useTheme } from '../../contexts/ThemeContext'
import { CHOICE_PREVIEW_LIMIT } from '../../utils/parseFlow'

/** Triângulo de alerta (12px). A semântica "aviso" vem da FORMA, não só da cor —
 *  mitiga a colisão do âmbar com a aresta de redirect e a cor do nó-grupo. */
const alertTriangle = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export function ChoiceNode({ data, selected }: { data: FlowNodeData; selected?: boolean }) {
  const isDark = useTheme()
  const isList = data.actionType === 'list'

  // Conectividade posicional (buttons[i] ↔ buttonConnected[i]); ausente = conectado.
  const connected = data.buttonConnected ?? []
  const unlinkedCount = data.buttons.filter((_, i) => connected[i] === false).length

  // Âmbar com contraste em cada tema (ThemeContext — sem `dark:` do Tailwind).
  const amber = isDark ? '#fbbf24' : '#d97706'

  return (
    <NodeShell
      kind="choiceNode"
      title={data.name}
      subtitle={data.category}
      selected={selected}
      icon={isList ? listIcon() : undefined}
    >
      {/* Badge agregado: captura opções soltas mesmo as escondidas pelo "+N opções". */}
      {unlinkedCount > 0 && (
        <div
          className="inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 py-0.5 self-start"
          style={{ backgroundColor: amber + (isDark ? '26' : '1f'), color: amber }}
          title="Opções de menu sem destino — o bot não segue por elas"
        >
          {alertTriangle}
          {unlinkedCount === 1 ? '1 opção sem conexão' : `${unlinkedCount} opções sem conexão`}
        </div>
      )}
      <NodePreview text={data.messagePreview} />
      {data.buttons.length > 0 && (
        <div className="flex flex-col gap-1">
          {data.buttons.slice(0, CHOICE_PREVIEW_LIMIT).map((btn, i) => (
            <NodePill key={btn.id} kind="choiceNode" className="w-full">
              <span className="flex-1 truncate text-left" title={btn.description ?? btn.text}>{btn.text}</span>
              {connected[i] === false && (
                <span style={{ color: amber }} title="Opção sem conexão">{alertTriangle}</span>
              )}
            </NodePill>
          ))}
          {data.buttons.length > CHOICE_PREVIEW_LIMIT && (
            <NodeNote>+{data.buttons.length - CHOICE_PREVIEW_LIMIT} opções</NodeNote>
          )}
        </div>
      )}
    </NodeShell>
  )
}
