import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { StartNode } from './nodes/StartNode'
import { ChoiceNode } from './nodes/ChoiceNode'
import { CaptureNode } from './nodes/CaptureNode'
import { TransferNode } from './nodes/TransferNode'
import { DefaultNode } from './nodes/DefaultNode'
import { ExportControls } from './ExportControls'
import type { FlowNodeData } from '../types'

const nodeTypes = {
  startNode: StartNode,
  choiceNode: ChoiceNode,
  captureNode: CaptureNode,
  transferNode: TransferNode,
  defaultNode: DefaultNode,
}

interface FlowCanvasProps {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
}

export function FlowCanvas({ nodes, edges }: FlowCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color="#e2e8f0" />
      <Controls />
      <MiniMap
        nodeColor={node => {
          const colors: Record<string, string> = {
            startNode: '#10b981',
            choiceNode: '#3b82f6',
            captureNode: '#8b5cf6',
            transferNode: '#f43f5e',
            defaultNode: '#64748b',
          }
          return colors[node.type ?? 'defaultNode'] ?? '#64748b'
        }}
        maskColor="rgba(248,250,252,0.7)"
      />
      <ExportControls />
    </ReactFlow>
  )
}
