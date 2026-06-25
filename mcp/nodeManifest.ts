import {
  NODE_CATALOG, CREATABLE_KINDS, ACTION_KINDS_WITH_ERROR, type CreatableKind,
} from '../src/utils/nodeCatalog'

/**
 * Manifesto dos tipos de nó para o servidor MCP — DERIVADO de `NODE_CATALOG`
 * (Fase 2). Antes da Fase 2 este arquivo era `mcp/nodeCatalog.ts` e mantinha à
 * mão `summary`/`fields`/`actionType`, que divergiam silenciosamente da verdade
 * do app. Agora é um FORMATADOR fino: toda substância (label, actionType,
 * summary, fields, hasError) vem do catálogo único em `src/utils/nodeCatalog.ts`.
 *
 * Duas saídas: `manifest()` (1 linha por kind, vai nas instructions do MCP, sempre
 * no contexto do agente) e `describeNodeType(kind)` (detalhe sob demanda — a tool
 * `describe_node_type`), espelhando a filosofia "listar barato / descrever sob demanda".
 */

export interface NodeTypeSpec {
  kind: CreatableKind
  label: string
  actionType: string
  summary: string
  fields: string[]
}

/** Catálogo achatado em lista ordenada (kind + os campos do NODE_CATALOG). */
export const NODE_TYPE_SPECS: NodeTypeSpec[] = CREATABLE_KINDS.map(kind => {
  const { label, actionType, summary, fields } = NODE_CATALOG[kind]
  return { kind, label, actionType, summary, fields }
})

/** Manifesto compacto — 1 linha por kind. */
export function manifest(): string {
  return NODE_TYPE_SPECS.map(s => {
    const err = ACTION_KINDS_WITH_ERROR.has(s.kind) ? ' [tem bloco error→start]' : ''
    return `• ${s.kind} ("${s.label}", action=${s.actionType}) — ${s.summary}${err}`
  }).join('\n')
}

/** Detalhe de UM tipo de nó (campos configuráveis), sob demanda. */
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
