import { useState, useCallback, useEffect, useRef } from 'react'
import { ReactFlow, Background, Controls, MiniMap, useReactFlow, applyNodeChanges, type Node, type Edge, type NodeMouseHandler, type MiniMapNodeProps, type NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { StartNode }       from './nodes/StartNode'
import { ChoiceNode }      from './nodes/ChoiceNode'
import { CaptureNode }     from './nodes/CaptureNode'
import { TransferNode }    from './nodes/TransferNode'
import { DefaultNode }     from './nodes/DefaultNode'
import { WaitNode }        from './nodes/WaitNode'
import { SetDataNode }     from './nodes/SetDataNode'
import { ExternalBotNode } from './nodes/ExternalBotNode'
import { ExportControls }  from './ExportControls'
import type { FlowNodeData } from '../types'

const nodeTypes = {
  startNode:       StartNode,
  choiceNode:      ChoiceNode,
  captureNode:     CaptureNode,
  transferNode:    TransferNode,
  defaultNode:     DefaultNode,
  waitNode:        WaitNode,
  setDataNode:     SetDataNode,
  externalBotNode: ExternalBotNode,
}

const NODE_COLORS: Record<string, string> = {
  startNode:       '#10b981',
  choiceNode:      '#3b82f6',
  captureNode:     '#8b5cf6',
  transferNode:    '#f43f5e',
  waitNode:        '#06b6d4',
  setDataNode:     '#6366f1',
  externalBotNode: '#f59e0b',
  defaultNode:     '#64748b',
}

function MiniMapNodeRect({ x, y, width, height, color }: MiniMapNodeProps) {
  return <rect x={x} y={y} width={width} height={height} fill={color} rx={6} ry={6} />
}

interface FlowCanvasProps {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
  isDark: boolean
  onNodeClick: (node: Node<FlowNodeData>) => void
  onSpacingIncrease: () => void
  onSpacingDecrease: () => void
}

export function FlowCanvas({ nodes: propNodes, edges, isDark, onNodeClick, onSpacingIncrease, onSpacingDecrease }: FlowCanvasProps) {
  const [nodes, setNodes] = useState(propNodes)

  useEffect(() => { setNodes(propNodes) }, [propNodes])

  const handleNodesChange = useCallback((changes: NodeChange<Node<FlowNodeData>>[]) => {
    const dimensionChanges = changes.filter(c => c.type === 'dimensions')
    if (dimensionChanges.length) setNodes(curr => applyNodeChanges(dimensionChanges, curr))
  }, [])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => onNodeClick(node as Node<FlowNodeData>),
    [onNodeClick]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color={isDark ? '#1e293b' : '#e2e8f0'} />
      <Controls />
      <MiniMap
        nodeColor={node => NODE_COLORS[node.type ?? 'defaultNode'] ?? '#64748b'}
        maskColor={isDark ? 'rgba(15,23,42,0.75)' : 'rgba(248,250,252,0.7)'}
        nodeComponent={MiniMapNodeRect}
      />
      <LayoutFitter nodeCount={propNodes.length} />
      <ExportControls onSpacingIncrease={onSpacingIncrease} onSpacingDecrease={onSpacingDecrease} />
    </ReactFlow>
  )
}

function LayoutFitter({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow()
  const prevCount = useRef(0)

  useEffect(() => {
    if (!nodeCount || nodeCount === prevCount.current) return
    prevCount.current = nodeCount
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 350 }), 60)
    return () => clearTimeout(timer)
  }, [nodeCount])

  return null
}
