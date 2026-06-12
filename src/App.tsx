import { useState, useCallback, useRef, useEffect } from 'react'
import { reconnectEdge, type Connection, type Node, type Edge } from '@xyflow/react'
import { FlowCanvas }    from './components/FlowCanvas'
import { JsonInput }     from './components/JsonInput'
import { DetailPanel }   from './components/DetailPanel'
import { ThemeToggle }   from './components/ThemeToggle'
import { ThemeContext }  from './contexts/ThemeContext'
import { parseFlow } from './utils/parseFlow'
import { applyEdgeReconnect, serializeFlow } from './utils/editFlow'
import type { BotFlowJson, FlowNodeData } from './types'

const SPACING_STEP = 60
const SPACING_MIN  = 20
const SPACING_MAX  = 600

export default function App() {
  const [isDark, setIsDark]             = useState(() => document.documentElement.classList.contains('dark'))
  const [jsonText, setJsonText]         = useState('')
  const [nodes, setNodes]               = useState<Node<FlowNodeData>[]>([])
  const [edges, setEdges]               = useState<Edge[]>([])
  const [error, setError]               = useState<string | null>(null)
  const [hasFlow, setHasFlow]           = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null)
  const parsedDataRef                   = useRef<BotFlowJson | null>(null)
  const spacingRef                      = useRef({ ranksep: 60, nodesep: 40 })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = useCallback(() => setIsDark(d => !d), [])

  function handleGenerate() {
    if (!jsonText.trim()) {
      setError('Cole ou importe um JSON antes de gerar o fluxo.')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      setError('JSON inválido. Verifique a sintaxe e tente novamente.')
      return
    }
    const data = parsed as BotFlowJson
    if (!data?.list || !Array.isArray(data.list)) {
      setError('O JSON deve conter uma propriedade "list" com o array de intents.')
      return
    }
    if (data.list.length === 0) {
      setError('A lista de intents está vazia.')
      return
    }
    try {
      parsedDataRef.current = data
      const result = parseFlow(data, spacingRef.current)
      setNodes(result.nodes)
      setEdges(result.edges)
      setError(null)
      setHasFlow(true)
      setSelectedNode(null)
    } catch (e) {
      setError(`Erro ao processar o fluxo: ${e instanceof Error ? e.message : 'desconhecido'}`)
    }
  }

  const handleSpacingChange = useCallback((delta: number) => {
    if (!parsedDataRef.current) return
    const prev = spacingRef.current
    const next = {
      ranksep: Math.min(SPACING_MAX, Math.max(SPACING_MIN, prev.ranksep + delta)),
      nodesep: Math.min(SPACING_MAX, Math.max(SPACING_MIN, prev.nodesep + delta)),
    }
    spacingRef.current = next
    const result = parseFlow(parsedDataRef.current, next)
    setNodes(result.nodes)
    setEdges(result.edges)
  }, [])

  function handleJsonChange(value: string) {
    setJsonText(value)
    setError(null)
  }

  /**
   * Reconecta o destino de uma aresta: aplica o patch no modelo (fonte de
   * verdade para exportação) e, só se ele for válido, atualiza o canvas.
   * O ID da aresta é preservado porque codifica a posição no modelo.
   */
  const handleReconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    const model = parsedDataRef.current
    if (!model) return
    const result = applyEdgeReconnect(model, oldEdge.id, oldEdge.target, connection.target)
    if (!result.ok) {
      setError(`Não foi possível reconectar: ${result.reason}.`)
      return
    }
    setEdges(eds => reconnectEdge(oldEdge, connection, eds, { shouldReplaceId: false }))
    setError(null)
  }, [])

  function handleExportJson() {
    const model = parsedDataRef.current
    if (!model) return
    const blob = new Blob([serializeFlow(model)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = 'fluxo.json'
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNodeClick = useCallback((node: Node<FlowNodeData>) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  const handleClosePanel = useCallback(() => setSelectedNode(null), [])

  return (
    <ThemeContext.Provider value={isDark}>
    <div className={`flex h-screen transition-colors duration-200 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
      <aside className={`w-96 flex-shrink-0 border-r flex flex-col shadow-sm transition-colors duration-200 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <JsonInput
          value={jsonText}
          onChange={handleJsonChange}
          onSubmit={handleGenerate}
          error={error}
          themeToggle={<ThemeToggle isDark={isDark} onToggle={toggleTheme} />}
        />
      </aside>

      <main className="flex-1 relative overflow-hidden">
        {hasFlow ? (
          <>
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              isDark={isDark}
              onNodeClick={handleNodeClick}
              onReconnect={handleReconnect}
              onExportJson={handleExportJson}
              onSpacingIncrease={() => handleSpacingChange(SPACING_STEP)}
              onSpacingDecrease={() => handleSpacingChange(-SPACING_STEP)}
            />
            {selectedNode && (
              <DetailPanel node={selectedNode} onClose={handleClosePanel} />
            )}
          </>
        ) : (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="4" rx="1" />
              <rect x="14" y="3" width="7" height="4" rx="1" />
              <rect x="8" y="17" width="8" height="4" rx="1" />
              <line x1="6.5" y1="7" x2="6.5" y2="10" />
              <line x1="17.5" y1="7" x2="17.5" y2="10" />
              <line x1="6.5" y1="10" x2="17.5" y2="10" />
              <line x1="12" y1="10" x2="12" y2="17" />
            </svg>
            <div className="text-center">
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum fluxo carregado</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cole o JSON no painel e clique em Gerar Fluxo</p>
            </div>
          </div>
        )}
      </main>
    </div>
    </ThemeContext.Provider>
  )
}
