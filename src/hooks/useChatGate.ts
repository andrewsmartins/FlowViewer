import type { ChatGate } from '../utils/chatGate'

/**
 * Ponto ÚNICO de derivação dos sinais do gate da caixinha de chat (decisão 2 do
 * PLANS §"Gate de acesso à caixinha"). Duas camadas que NÃO mudam juntas:
 *
 *  - **o gate** (a regra "bloqueia até os dois `true` + aviso individual", em
 *    `chatGatePending`) é igual hoje e em produção;
 *  - **a origem dos sinais** muda. HOJE (PoC/dev): `hasFlow` ← importar/criar um
 *    fluxo; `hasToken` ← chave de sessão na barra. Na FASE 5 (produto): ambos
 *    chegam prontos da OmniChat (query param / `postMessage` / config no boot).
 *
 * Isolando a fonte aqui, a Fase 5 troca SÓ este hook — o `ChatPanel` recebe
 * booleanos abstratos via props e não sabe de onde vieram. Implementar sem este
 * isolamento é retrabalho garantido.
 *
 * @param source Os dois sinais já derivados pelo App (dev) ou pela integração (prod).
 */
export function useChatGate(source: ChatGate): ChatGate {
  // Dev/PoC: repassa o estado do front. Produção (Fase 5): derivar daqui da
  // fonte injetada pela OmniChat, sem tocar no gate nem no ChatPanel.
  return source
}
