/**
 * Fonte única da configuração de API da OmniChat (bases + app-id + headers de sessão).
 *
 * Por quê existir: estes valores estavam DUPLICADOS entre o caminho de escrita
 * (`utils/pushFlow.ts`: `API`/`APP_ID`/`buildHeaders`) e o hub de leitura/resolução
 * (`utils/teams.ts`: `API`/`PARSE`/`APP_ID`/`sessionHeaders`). Cópias divergentes
 * abrem o pior caso silencioso — o app LER de um ambiente e GRAVAR em outro (push no
 * bot errado). Centralizando aqui, migrar de ambiente é editar um lugar só.
 *
 * Escopo desta "metade 1" (ver PLANS.md §"Fonte única de config de API"): apenas
 * deduplicar — os valores seguem IDÊNTICOS aos atuais, sem bump. São CONSTANTES
 * LITERAIS de propósito: este módulo roda TAMBÉM no caminho Node do servidor MCP
 * (via `tools/resolvers` → `utils/teams`), que não tem Vite — introduzir
 * `import.meta.env`/`process.env` aqui quebraria o `mcp:typecheck`/runtime. A
 * parametrização por ambiente é a "metade 2", do time da plataforma.
 *
 * Regra anti-ciclo: este módulo NÃO importa de `utils/pushFlow` nem `utils/teams`
 * (são eles que importam daqui). Por isso os tipos `FetchLike`/`FetchResponse`
 * continuam em `pushFlow.ts`, não migram para cá.
 */

/** Base da `execute-api` (bots/intents/times/endpoints/entities). */
export const API = 'https://k0yowczqxg.execute-api.us-east-1.amazonaws.com/prod'

/** Base do Parse (classes Team/Collection, cloud functions de usuários). */
export const PARSE = 'https://api-private2.omni.chat/parse'

/** Base do serviço de arquivos (upload de mídia via presigned URL do S3). */
export const FILES_API = 'https://private-api2.omni.chat/files'

/** ID público do app Parse (visível a qualquer navegador na plataforma — não é segredo). */
export const APP_ID = 'UCeS99itvZg1tsea2OSoyKvpLbKddhoVAPotIQOy'

/**
 * Versão do app web da OmniChat — o gateway de arquivos exige este header (401 sem
 * ele). Valor fixo capturado da plataforma; atualizar se a API passar a recusar
 * versões antigas.
 */
export const PLATFORM_VERSION = '1.116.16'

/**
 * Headers de sessão da API de intents/times (Bearer + session-token + app-id).
 * O token chega por parâmetro, vai só nos headers e NUNCA é logado. Compartilhado
 * por todo caminho que fala com a `execute-api`/`PARSE` (push, teams, endpoints,
 * entities, users, collections, messageTemplates).
 */
export function sessionHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-omnichat-platform': 'web',
    'x-parse-application-id': APP_ID,
    'x-parse-session-token': token,
  }
}
