import { describe, it, expect } from 'vitest'
import {
  NODE_CATALOG, CREATABLE_KINDS, CREATABLE_KIND_LABELS, ACTION_KINDS_WITH_ERROR,
  actionToNodeKind, actionTypeOf, isCreatableKind, type CreatableKind,
} from './nodeCatalog'

/**
 * Teste GOLDEN do catálogo (Fase 2). Trava os fatos por tipo de nó em valores
 * exatos esperados — qualquer drift silencioso de label/actionType/hasError falha
 * aqui. Como o DetailPanel passa a LER o label do catálogo, este teste é a rede de
 * segurança do refactor sem precisar de DOM (o projeto não tem jsdom/testing-library).
 */

// Espelho congelado do que a UI/MCP esperam hoje. NÃO derivar do catálogo —
// é a verdade independente contra a qual o catálogo é validado.
const EXPECTED: Record<CreatableKind, { label: string; actionType: string; hasError: boolean }> = {
  defaultNode:  { label: 'Mensagem',           actionType: 'none',              hasError: false },
  choiceNode:   { label: 'Escolha',            actionType: 'choice',            hasError: false },
  captureNode:  { label: 'Captura',            actionType: 'captureData',       hasError: true  },
  transferNode: { label: 'Transferência',      actionType: 'transfer',          hasError: true  },
  waitNode:     { label: 'Aguardar interação', actionType: 'waitForInteraction', hasError: false },
  setDataNode:  { label: 'Editar informação',  actionType: 'setData',           hasError: true  },
  endNode:      { label: 'Encerrar conversa',  actionType: 'endConversation',   hasError: false },
  apiCallNode:  { label: 'Chamada de API',     actionType: 'external',          hasError: true  },
  orderNode:    { label: 'Pedido',             actionType: 'order',             hasError: true  },
  csatNode:     { label: 'Captura CSAT',       actionType: 'captureCsat',       hasError: true  },
  storeNode:    { label: 'Loja física',        actionType: 'store',             hasError: true  },
}

describe('NODE_CATALOG (golden)', () => {
  it('tem exatamente os 11 kinds criáveis, na ordem da paleta', () => {
    expect([...CREATABLE_KINDS]).toEqual([
      'defaultNode', 'choiceNode', 'captureNode', 'transferNode', 'waitNode', 'setDataNode',
      'endNode', 'apiCallNode', 'orderNode', 'csatNode', 'storeNode',
    ])
  })

  it.each(CREATABLE_KINDS)('%s: label, actionType e hasError batem com o esperado', kind => {
    const entry = NODE_CATALOG[kind]
    expect(entry.label).toBe(EXPECTED[kind].label)
    expect(entry.actionType).toBe(EXPECTED[kind].actionType)
    expect(entry.hasError).toBe(EXPECTED[kind].hasError)
  })

  it('actionType é bijetivo (sem dois kinds compartilhando o mesmo action.type)', () => {
    const types = CREATABLE_KINDS.map(actionTypeOf)
    expect(new Set(types).size).toBe(types.length)
  })
})

describe('derivações do catálogo', () => {
  it('CREATABLE_KIND_LABELS reflete os labels do catálogo', () => {
    for (const kind of CREATABLE_KINDS) {
      expect(CREATABLE_KIND_LABELS[kind]).toBe(NODE_CATALOG[kind].label)
    }
  })

  it('ACTION_KINDS_WITH_ERROR = os 7 nós de ação (hasError true)', () => {
    expect([...ACTION_KINDS_WITH_ERROR].sort()).toEqual(
      ['apiCallNode', 'captureNode', 'csatNode', 'orderNode', 'setDataNode', 'storeNode', 'transferNode'],
    )
  })

  it('actionToNodeKind mapeia cada action.type ao seu kind', () => {
    for (const kind of CREATABLE_KINDS) {
      expect(actionToNodeKind({ type: NODE_CATALOG[kind].actionType } as never)).toBe(kind)
    }
  })

  it('actionToNodeKind cai para defaultNode em tipo ausente/desconhecido/null', () => {
    expect(actionToNodeKind(null)).toBe('defaultNode')
    expect(actionToNodeKind(undefined)).toBe('defaultNode')
    expect(actionToNodeKind({ type: 'tipoInexistente' } as never)).toBe('defaultNode')
  })

  it('isCreatableKind distingue criáveis de não-criáveis', () => {
    expect(isCreatableKind('orderNode')).toBe(true)
    expect(isCreatableKind('startNode')).toBe(false)
    expect(isCreatableKind('externalBotNode')).toBe(false)
    expect(isCreatableKind('xyz')).toBe(false)
  })
})
