/**
 * FONTE ÚNICA dos mapas de Transferência (nó `action.type === 'transfer'`), Node-pure.
 *
 * Antes esta tabela vivia DUPLICADA: uma cópia no `DetailPanel` (seletor de 2 níveis da
 * UI) e uma descrição solta no `NODE_CATALOG`. A duplicação sem fonte única foi a raiz do
 * bug que a v0.35.0 conserta — o agente gravou `transferType="team"` (valor inventado, fora
 * do enum) porque nada centralizava os 6 tipos válidos. Agora `DetailPanel`, `set_transfer`,
 * o `nodeCatalog` e o `validate()` importam DAQUI (CLAUDE.md: não duplicar).
 *
 * Node-pure de propósito: o `mcp/` e a camada de tools (`src/tools`) importam este arquivo e
 * rodam sem DOM. Só tipos e constantes — zero deps de browser (cor/ícone da badge são TEMA e
 * ficam no DetailPanel).
 *
 * O nó de Transferência é um seletor de DOIS níveis espelhando a plataforma:
 * - Nível 1 = CATEGORIA (`userPrevious` · `branch` · `user` · `group`);
 * - Nível 2 = SUB-OPÇÃO (só `user`/`group` têm) que decide o `transferType` final (1 dos 6)
 *   e o TIPO de campo de destino: picker de nome→objectId, variável verbatim, ou nenhum.
 */

/** Campo de destino que cada `transferType` exige. */
export type TransferField = 'none' | 'userPicker' | 'teamPicker' | 'variable'

/**
 * As 4 CATEGORIAS de transferência (nível 1). `as const` preserva os literais para o
 * `z.enum` do servidor MCP (via `TRANSFER_CATEGORY_VALUES`) e para o seletor da UI.
 */
export const TRANSFER_CATEGORIES = [
  { value: 'userPrevious', label: 'Devolver ao vendedor' },
  { value: 'branch',       label: 'Pelo endereço físico' },
  { value: 'user',         label: 'Por vendedor' },
  { value: 'group',        label: 'Por time' },
] as const

/** Os valores das categorias como tupla de literais (base do `z.enum` do `set_transfer`). */
export const TRANSFER_CATEGORY_VALUES = ['userPrevious', 'branch', 'user', 'group'] as const
export type TransferCategory = (typeof TRANSFER_CATEGORY_VALUES)[number]

/**
 * `transferType` → categoria / sub-opção / campo de destino. Usado pelo `buildDraft` da UI
 * (derivar o seletor a partir do que está salvo), pelo gate ("o tipo exige valor?") e pelo
 * nudge do `validate()`. Os 6 tipos são o enum real da plataforma.
 */
export const TRANSFER_MAP: Record<string, { category: string; sub: string | null; field: TransferField }> = {
  direct4userPrevious: { category: 'userPrevious', sub: null,       field: 'none' },
  directFromBranch:    { category: 'branch',       sub: null,       field: 'none' },
  direct4user:         { category: 'user',         sub: 'name',     field: 'userPicker' },
  search4user:         { category: 'user',         sub: 'email',    field: 'variable' },
  direct4group:        { category: 'group',        sub: 'simple',   field: 'teamPicker' },
  search4group:        { category: 'group',        sub: 'advanced', field: 'variable' },
}

/** Sub-opções por categoria (nível 2). Categorias ausentes aqui não têm nível 2. */
export const TRANSFER_SUBS: Record<string, { value: string; label: string; transferType: string }[]> = {
  user: [
    { value: 'name',  label: 'Busca por nome', transferType: 'direct4user' },
    { value: 'email', label: 'Por e-mail',     transferType: 'search4user' },
  ],
  group: [
    { value: 'simple',   label: 'Busca simples',  transferType: 'direct4group' },
    { value: 'advanced', label: 'Busca avançada', transferType: 'search4group' },
  ],
}

/** `transferType` das categorias SEM nível 2 (mapeamento direto 1↔1). */
export const TRANSFER_NOSUB: Record<string, string> = {
  userPrevious: 'direct4userPrevious',
  branch:       'directFromBranch',
}

/** Campo exigido por um `transferType` (default 'none' para legados/desconhecidos). */
export function transferFieldOf(transferType: string): TransferField {
  return TRANSFER_MAP[transferType]?.field ?? 'none'
}

/**
 * Resolve `(categoria, sub?)` → `transferType` (um dos 6), validando o acoplamento —
 * espelha a derivação do seletor de 2 níveis do DetailPanel. É o núcleo que o `set_transfer`
 * usa para transformar a intenção do agente ("por time, busca simples") no tipo canônico,
 * matando o "team" inventado. Categoria inválida / sub faltando ou inválida = erro (nunca
 * chuta um default silencioso).
 */
export function resolveTransferType(
  category: string, sub?: string,
): { ok: true; transferType: string; field: TransferField } | { ok: false; reason: string } {
  const subs = TRANSFER_SUBS[category]
  if (subs) {
    const opts = subs.map(s => s.value).join(' | ')
    // `sub` chega como texto livre da tool (não é enum no schema): normaliza (trim + minúsculas)
    // antes de casar, senão " name " ou "Name" — intenção válida — viraria erro-duro. Os valores
    // canônicos (name/email/simple/advanced) são minúsculos, então normalizar não perde nada.
    const key = (sub ?? '').trim().toLowerCase()
    if (!key) return { ok: false, reason: `a categoria "${category}" exige uma sub-opção (${opts})` }
    const found = subs.find(s => s.value === key)
    if (!found) return { ok: false, reason: `sub-opção inválida "${sub}" para "${category}" (use ${opts})` }
    return { ok: true, transferType: found.transferType, field: transferFieldOf(found.transferType) }
  }
  // Categoria SEM nível 2 (userPrevious/branch): mapeia 1↔1; um `sub` extra é ignorado
  // (o nível 2 não existe para esta categoria), não é erro.
  const noSub = TRANSFER_NOSUB[category]
  if (noSub) return { ok: true, transferType: noSub, field: transferFieldOf(noSub) }
  const cats = TRANSFER_CATEGORY_VALUES.join(' | ')
  return { ok: false, reason: `categoria de transferência inválida "${category}" (use ${cats})` }
}
