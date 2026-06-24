import {
  CREATABLE_KINDS, CREATABLE_KIND_LABELS, ACTION_KINDS_WITH_ERROR,
  type CreatableKind,
} from '../src/utils/intentTemplates'

/**
 * Manifesto ENXUTO dos tipos de nó criáveis (Fase 3, PLANS.md § "Fase 3").
 *
 * Por quê escrito à mão aqui: na Fase 2 a verdade hoje espalhada (NodeKind,
 * actionToNodeKind, defaults dos templates, consts do DetailPanel) será
 * consolidada num único `NODE_CATALOG`; este arquivo passa a DERIVAR dela. Até
 * lá, é o catálogo mínimo que o agente precisa para escolher um `kind` e saber
 * que campos cada tipo aceita — sem inchar o contexto com JSON cru.
 *
 * Reusa as fontes únicas que JÁ existem (rótulos e o Set de tipos com bloco
 * `error`) para não divergir; só o `summary`/`fields`/`actionType` são escritos
 * à mão (o `ACTION_TYPE_BY_KIND` dos templates é privado).
 */

export interface NodeTypeSpec {
  kind: CreatableKind
  /** Rótulo amigável (fonte única: CREATABLE_KIND_LABELS). */
  label: string
  /** `action.type` que o nó materializa. */
  actionType: string
  /** Uma linha: o que o nó faz. */
  summary: string
  /** Campos configuráveis via tools, com dica de valores. `[]` = nenhum. */
  fields: string[]
}

/**
 * Detalhe por kind. `actionType`/`summary`/`fields` escritos à mão (mínimos);
 * os valores de enum (transferType, captureDataType, …) vêm do contrato real da
 * plataforma já documentado no PLANS.md/spec.
 */
const SPECS: Record<CreatableKind, Omit<NodeTypeSpec, 'kind' | 'label'>> = {
  defaultNode: {
    actionType: 'none',
    summary: 'Mensagem simples (texto/mídia). Encadeia para o próximo nó via connect.',
    fields: [],
  },
  choiceNode: {
    actionType: 'choice',
    summary: 'Menu de escolha (LIST/BUTTON): cada item leva a um destino.',
    fields: ['choices → use set_choices (destinos posicionais), não set_action_field'],
  },
  captureNode: {
    actionType: 'captureData',
    summary: 'Captura dado(s) do contato (nome, e-mail, CPF, …).',
    fields: [
      'captureDataType: mail | name | fullName | fullPhoneNumber | cpf | cnpj | zipcode | … | free',
      'captureDataTypesCategory: singleField | multipleFields',
      'multipleFields: lista de campos (só no modo multipleFields)',
    ],
  },
  transferNode: {
    actionType: 'transfer',
    summary: 'Transfere a conversa para um time ou atendente humano (folha — o bot para).',
    fields: [
      'transferType: search4group | direct4group | search4user | direct4user | directFromBranch | direct4userPrevious',
      'value: ID do time/usuário (resolvido na Fase 4; NUNCA inventar — peça ao humano)',
    ],
  },
  waitNode: {
    actionType: 'waitForInteraction',
    summary: 'Aguarda a próxima interação do contato. Sem campos.',
    fields: [],
  },
  setDataNode: {
    actionType: 'setData',
    summary: 'Edita variáveis do contato (bulkUpdate variable/value).',
    fields: ['bulkUpdate: ⚠️ ainda NÃO exposto por tool nesta fase (limitação da spike)'],
  },
  endNode: {
    actionType: 'endConversation',
    summary: 'Encerra a conversa. Terminal. Sem campos.',
    fields: [],
  },
  apiCallNode: {
    actionType: 'external',
    summary: 'Chama uma API/integração já configurada no bot (referência, nunca cria).',
    fields: [
      'apiName: ID da integração existente (resolvido na Fase 4; NUNCA inventar)',
      'externalType: tipo da chamada (ex.: request)',
    ],
  },
  orderNode: {
    actionType: 'order',
    summary: 'Ação de pedido: gerar pedido ou adicionar item ao carrinho.',
    fields: [
      'orderType: generateOrder | addToCart',
      'variable: variável do item (só em addToCart, ex.: @custom.produto)',
    ],
  },
  csatNode: {
    actionType: 'captureCsat',
    summary: 'Captura avaliação CSAT (nota ou comentário).',
    fields: ['captureDataType: supportRate | supportRateComment'],
  },
  storeNode: {
    actionType: 'store',
    summary: 'Ação sobre a loja física.',
    fields: ['storeType: first'],
  },
}

/** Catálogo completo, combinando rótulo (fonte única) + detalhe escrito à mão. */
export const NODE_TYPE_SPECS: NodeTypeSpec[] = CREATABLE_KINDS.map(kind => ({
  kind,
  label: CREATABLE_KIND_LABELS[kind],
  ...SPECS[kind],
}))

/**
 * Manifesto compacto — 1 linha por kind. Vai nas `instructions` do servidor MCP
 * (sempre no contexto do agente), conforme a Fase 3.
 */
export function manifest(): string {
  return NODE_TYPE_SPECS.map(s => {
    const err = ACTION_KINDS_WITH_ERROR.has(s.kind) ? ' [tem bloco error→start]' : ''
    return `• ${s.kind} ("${s.label}", action=${s.actionType}) — ${s.summary}${err}`
  }).join('\n')
}

/**
 * Detalhe de UM tipo de nó (campos configuráveis), sob demanda — a tool
 * `describe_node_type(kind)`. Mesma filosofia "listar barato / descrever sob
 * demanda" do `list_nodes`/`describe_node`.
 */
export function describeNodeType(kind: string): string {
  const spec = NODE_TYPE_SPECS.find(s => s.kind === kind)
  if (!spec) {
    return `⚠️ tipo desconhecido "${kind}". Criáveis: ${CREATABLE_KINDS.join(', ')}`
  }
  const hasError = ACTION_KINDS_WITH_ERROR.has(spec.kind)
  return [
    `${spec.kind} — "${spec.label}" (action.type=${spec.actionType})`,
    spec.summary,
    hasError
      ? 'Caminho de erro: nasce com action.error → start (preservado no round-trip).'
      : 'Sem caminho de erro.',
    spec.fields.length
      ? 'Campos configuráveis:'
      : 'Sem campos configuráveis — use connect para ligar ao próximo nó.',
    ...spec.fields.map(f => `  - ${f}`),
  ].join('\n')
}
