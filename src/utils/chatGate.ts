/**
 * Gate de acesso à caixinha de chat do agente construtor (PLANS §"Gate de acesso
 * à caixinha de chat"). Lógica pura, sem React nem DOM — testável isolada e
 * reusável quando a Fase 5 trocar a fonte dos sinais.
 *
 * Regra (decisão 1): a caixinha só abre com `hasFlow && hasToken`. Quando falta
 * algo, lista-se SÓ os requisitos pendentes, em ordem estável (fluxo antes do
 * token), para o popover mostrar "só o que falta" — 0 itens libera, 1 = falta
 * um, 2 = faltam os dois (decisão 3, o "individual").
 */

/** Requisito de acesso à caixinha. */
export type ChatGateRequirement = 'flow' | 'token'

/** Sinais abstratos do gate — o ChatPanel os recebe sem saber de onde vieram (decisão 2). */
export interface ChatGate {
  /** Há um fluxo carregado no canvas. */
  hasFlow: boolean
  /** Há um token de sessão disponível. */
  hasToken: boolean
}

/**
 * Deriva os requisitos pendentes para abrir a caixinha.
 * @returns Lista dos pendentes em ordem estável; vazia quando ambos satisfeitos.
 */
export function chatGatePending(hasFlow: boolean, hasToken: boolean): ChatGateRequirement[] {
  const pending: ChatGateRequirement[] = []
  if (!hasFlow) pending.push('flow')
  if (!hasToken) pending.push('token')
  return pending
}
