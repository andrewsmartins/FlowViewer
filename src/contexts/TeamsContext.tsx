import { createContext, useContext } from 'react'
import type { Team } from '../utils/teams'

/** Estado do carregamento dos times da loja (variável `@team`). */
export type TeamsStatus = 'idle' | 'loading' | 'loaded' | 'error'

/**
 * Times da loja para o picker de variáveis `@team`, disponibilizados por contexto
 * (evita threadar props por App → DetailPanel → VariablePicker → VariableMenu).
 * O fetch real vive no App (tem o token e o botId); aqui só expomos o resultado,
 * o disparo (`loadTeams`) e o mapa id→nome para exibição.
 */
export interface TeamsContextValue {
  teams: Team[]
  status: TeamsStatus
  /** Mensagem de erro amigável (sem token), quando `status === 'error'`. */
  error: string | null
  /** Dispara o carregamento (idempotente: não refaz se já está carregando). */
  loadTeams: () => void
  /** Há token de sessão definido? Quando true, o picker carrega os times sozinho. */
  hasToken: boolean
  /** Abre o campo de token (barra) — usado pelo aviso "Insira o token da sessão". */
  requestToken: () => void
  /** Mapa objectId→nome, para o `variableDisplay` mostrar o nome do time. */
  byId: ReadonlyMap<string, string>
}

const EMPTY: TeamsContextValue = {
  teams: [],
  status: 'idle',
  error: null,
  loadTeams: () => {},
  hasToken: false,
  requestToken: () => {},
  byId: new Map(),
}

export const TeamsContext = createContext<TeamsContextValue>(EMPTY)

export function useTeams() {
  return useContext(TeamsContext)
}
