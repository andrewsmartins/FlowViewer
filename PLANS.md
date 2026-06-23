# PLANS.md — FlowViewer: de visualizador a editor de fluxos OmniChat

<!-- HANDOFF:START -->
## 🔄 Handoff — 2026-06-23 (Seção "Em caso de erro" — Fases 1 e 2 CONCLUÍDAS; falta a Fase 3)

**Foco da próxima sessão:** **Fase 3** da feature "Seção 'Em caso de erro' (action.error) nos 7 nós de ação" — **validação visual/manual + release**. Toda a máquina (Fase 1) e a UI (Fase 2) já estão codadas, com tsc + 373 testes + build verdes. **Nada commitado ainda** (working tree sujo).

**Onde paramos:** branch `feat/execution-delay`. Esta sessão implementou Fases 1 e 2 (sem commit):
- **Fase 1 (utils):** [editIntent.ts](src/utils/editIntent.ts) — `MessageRef.container?:'condition'|'error'`; helper `saysOf(cond,container,create)`; `getMessage` + os 4 writers (`addText/Media/Collection/Template`) + `removeMessage` roteiam por container; novos `listErrorMessages` e `setActionErrorNext`; extraí `toEditableMessage`. [intentTemplates.ts](src/utils/intentTemplates.ts) — `canonicalError` agora `continueFlow`+`intentBot:''` (D10); `buildKindAction` materializa `action.error` nos 7 kinds via `ACTION_KINDS_WITH_ERROR` (D9). +14 testes em [editIntent.test.ts](src/utils/editIntent.test.ts) + ajustes em [intentTemplates.test.ts](src/utils/intentTemplates.test.ts).
- **Fase 2 (UI, tudo em [DetailPanel.tsx](src/components/DetailPanel.tsx)):** `Draft` + `errorMessages`/`newErrorMessages`/`removedErrorRefs`/`errorRedirect`/`errorIntent`; `buildDraft` inicializa via helper `errorNextDraft`. Extraí **`MessageListEditor`** (lista existentes+novas+AddMenu, parametrizado por `keyPrefix`) — a seção "Mensagens" principal e a nova `ErrorActionSection` o reusam. `Section` ganhou modo `collapsible`/`defaultOpen`. **`ErrorActionSection`** (colapsável, fechada; gated por `ERROR_ACTION_KINDS`) = `MessageListEditor` + `IntentSelect` (default Start) + 2 rádios redirect. Apply: fatorei `messageDiff(container,...)`, rodado p/ `'condition'` e (nos 7 kinds) `'error'` + `setActionErrorNext`; validação de TEMPLATE incompleto estendida ao erro. Sem gate.

**Fios soltos / meio-feito:**
- **Validação visual/manual NÃO feita** (deferida p/ Fase 3): round-trip dos 7 kinds com fluxo/token real — importar → editar mensagens+intenção+rádio → export bate, demais campos preservados. Importar `error.next.redirect` fora de {continueFlow,waitInteraction} (preserva?) e `intent` fora do fluxo (→ "(fora do fluxo)" no IntentSelect). Sem-token p/ COLLECTION/TEMPLATE no erro.
- **CHANGELOG + bump pendentes** (Fase 3). package.json já está em **0.24.0** (lote não lançado já reivindicado por Chamada de API/Transferência) — decidir se "Em caso de erro" entra no mesmo lote 0.24.0 ou novo MINOR.
- **Possível corte de escopo:** se na prática só TEXT/mídia bastam como fallback, dá pra esconder COLLECTION/TEMPLATE no erro (hoje incluídos, menos BUTTON/LIST).

**Armadilhas desta sessão:**
- **Decisão de assinatura (confirmada com Andy):** `setActionErrorNext(intent, condIdx, {redirect, intent})` deriva `intentBot` de `intent.botId` (não recebe botId por argumento). `continueFlow→intentBot:''`; `waitInteraction→intentBot:<botId>`.
- **`saysOf` só cria estrutura no modo write** (`create=true`); leituras (`getMessage`, `listErrorMessages`) NÃO materializam `action.error` — senão `listErrorMessages` corromperia toda condição com erro vazio. `next` placeholder `{type:'error'}` é sobrescrito depois por `setActionErrorNext`.
- **Colisão de chaves de edição (COLLECTION/TEMPLATE):** `editingColl`/`editingTpl` são `Set<string>` keyed por `condIdx-sayIdx-msgIdx`; respostas e erro na mesma posição colidiriam → `MessageListEditor` recebe `keyPrefix` (`''` p/ respostas, `'err-'` p/ erro), compartilhando os mesmos Sets sem conflito.
- **`messageDiff` resolve o `cur` (fallback de TEMPLATE) pelo container** (`ref.container==='error'` lê `action.error.assistant_says`); o caminho antigo lia só `assistant_says`.
- **Salvaguarda:** BUTTON/LIST no container de erro (patológico, importado) cai na linha de mídia removível — `ButtonListSummary` é pulado quando `ref.container==='error'` (leria caminho errado).
- **`setActionErrorNext` SEMPRE roda nos 7 kinds no Apply** (normaliza `type:'error'`+`action:'intent'`); idempotente p/ nós já corretos. Imports com `error.next` custom são lidos no `buildDraft` e reescritos iguais (preservados).

**Próximo passo imediato:** rodar o app (`/run` ou `npm run dev`), importar um fluxo de teste com os 7 nós de ação, expandir "Em caso de erro" em cada um, adicionar mensagem + trocar intenção + alternar rádio, Aplicar e exportar; conferir round-trip e preservação. Ajustar visual se preciso. Depois CHANGELOG (Adicionado) + bump + `/code-review` antes de commitar.

**Ponteiros:**
- Plano completo: PLANS.md § "Feature — Seção 'Em caso de erro'" — JSON alvo, D1–D10, fases, riscos.
- Componentes-chave: `MessageListEditor`, `ErrorActionSection`, `ERROR_ACTION_KINDS`, `messageDiff` (dentro de `handleApply`), `errorNextDraft`, `Section` colapsável — todos em [DetailPanel.tsx](src/components/DetailPanel.tsx).
- Utils: `setActionErrorNext`/`listErrorMessages`/`saysOf` em [editIntent.ts](src/utils/editIntent.ts); `canonicalError`/`ACTION_KINDS_WITH_ERROR` em [intentTemplates.ts](src/utils/intentTemplates.ts).

**Skills sugeridas:** `/run` (ou `/verify`) para o round-trip dos 7 kinds com token real; `/code-review` antes de commitar.
<!-- HANDOFF:END -->

## Feature — Seção "Em caso de erro" (action.error) nos 7 nós de ação

> **PLANEJADA em 2026-06-22** (interrogatório). Branch atual: `feat/execution-delay`. Os 7 nós de ação — **Capturar informação** (`captureNode`), **Editar informação** (`setDataNode`), **Ações loja física** (`storeNode`), **Chamada API** (`apiCallNode`), **Transferência de atendimento** (`transferNode`), **Pedido** (`orderNode`), **Captura CSAT** (`csatNode`) — ganham uma seção colapsável **"Em caso de erro"** no [DetailPanel](src/components/DetailPanel.tsx), que edita `action.error.assistant_says` (mensagens de fallback) e `action.error.next` (próximo fluxo após o erro). Hoje o `action.error` é só preservado no import (transfer/capture nascem com `canonicalError`; os outros 5 nem isso) — nunca editável.

**Objetivo (uma frase):** seção colapsável "Em caso de erro" com (1) botão "+ Adicionar mensagem" (editor rico exceto BUTTON/LIST), (2) "Próximo fluxo após o erro" via `IntentSelect` (default Start) e (3) dois rádios mutuamente exclusivos — *seguir o próximo fluxo* (`continueFlow`, padrão) **ou** *aguardar interação do cliente* (`waitInteraction`).

### Estrutura JSON alvo (`action.error`)
```jsonc
"error": {
  "assistant_says": [{ "channel": "any", "messages": [ /* TEXT/IMAGE/FILE/VIDEO/COLLECTION/TEMPLATE */ ] }],
  "next": {
    "redirect": "continueFlow",          // ou "waitInteraction"
    "type": "error",
    "intent": "<botId>-start",           // id da intenção escolhida (default = start sintética)
    "intentBot": "",                     // ACOPLADO: continueFlow→"" ; waitInteraction→<botId>
    "action": "intent"
  }
}
```
> Os 2 exemplos do Andy têm o MESMO `intent` (`<botId>-start`); a única diferença entre continueFlow e waitInteraction é `redirect` **e** `intentBot` → daí a regra de acoplamento (D3).

### Decisões (interrogatório 2026-06-22)
1. **D1 — Um componente compartilhado** `ErrorActionSection`, renderizado para os 7 `kind`s (espelha `StoreActionSection`/`ApiActionSection`). DRY.
2. **D2 — Seletor "Próximo fluxo após o erro" = só intenções locais** (mesmo bot). Reusa `IntentSelect` com `intents` do fluxo (`parsedDataRef.current?.list`, [App.tsx:1075](src/App.tsx#L1075)) — já inclui a intenção sintética `start` (`id: ${botId}-start`, `category:'start'`, [intentTemplates.ts:185](src/utils/intentTemplates.ts#L185)), então o default Start = `value` inicial `${botId}-start` e renderiza como "start". **Cross-bot descartado** (não pedido; traria picker de bots + token + forma-objeto). `error.next.intent` = id string; `action:'intent'`.
3. **D3 — `intentBot` acoplado ao `redirect`:** `continueFlow` → `intentBot:''`; `waitInteraction` → `intentBot:<botId atual>`. Replica exatamente os 2 JSONs do Andy.
4. **D4 — Editor de mensagens de erro = rico EXCETO BUTTON/LIST** (TEXT, IMAGE, FILE, VIDEO, COLLECTION, TEMPLATE). BUTTON/LIST mapeiam posicionalmente para `action.choices` (o `removeMessage` bloqueia quando `action.type==='choice'`, [editIntent.ts:119](src/utils/editIntent.ts#L119)) — sem `choices` no erro, virariam config órfã. O "+ Adicionar Resposta" some as opções Botões/Lista quando o alvo é o erro.
5. **D10 — `continueFlow` como padrão em TUDO.** `canonicalError` ([intentTemplates.ts:77](src/utils/intentTemplates.ts#L77)) muda de `redirect:'waitInteraction'`+`intentBot:botId` para `redirect:'continueFlow'`+`intentBot:''` (coerente com D3). Os 7 tipos nascem iguais.
6. **D9 — Eager:** `canonicalError(botId)` passa a entrar nos 7 templates criáveis em `buildKindAction` ([intentTemplates.ts:102](src/utils/intentTemplates.ts#L102)) — hoje só transfer/capture (linhas 112,119). **Andy confirmou que a plataforma aceita `action.error` nos 7 tipos** (order/csat/store/apiCall/setData incluídos). Todo nó editado materializa `action.error`.
7. **Sem gate.** A seção sempre tem default válido (Start + continueFlow) e mensagens são opcionais → nunca bloqueia "Aplicar".
8. **Colapsada por padrão**; clique expande.

### Implementação (mapa) — decisões técnicas (minhas, não do Andy)
- **Container das mensagens:** `MessageRef` ([editIntent.ts:12](src/utils/editIntent.ts#L12)) ganha `container?: 'condition' | 'error'` (default `'condition'`). Um helper `saysOf(cond, container)` resolve `cond.assistant_says` **ou** `cond.action.error.assistant_says` (criando `error`/`assistant_says` se faltar). `getMessage`/`updateMessageText`/`addTextMessage`/`addMediaMessage`/`addCollectionMessage`/`addTemplateMessage`/`removeMessage` passam a resolver via `saysOf`. Reusa a máquina inteira sem duplicar.
- **Draft + render separados:** novo `listErrorMessages(intent)` (walks `conditions → action.error.assistant_says`) e `draft.errorMessages` separado de `draft.messages`, para a seção de erro e a de respostas ficarem isoladas no painel. O Apply (hoje em [DetailPanel.tsx:2683-2713](src/components/DetailPanel.tsx#L2683)) é parametrizado por `container`: roda o mesmo diff (update TEXT / remove refs / add novas) para os dois conjuntos.
- **Writer do `error.next`:** helper focado (estender `updateActionFields` [editIntent.ts:651](src/utils/editIntent.ts#L651) com um `errorNext`, ou novo `setActionErrorNext`) que grava `redirect`/`intent`/`intentBot` aplicando o acoplamento da D3; `type:'error'`+`action:'intent'` fixos.
- **Componente `ErrorActionSection`:** `<Section title="Em caso de erro">` colapsável, gated por `kind ∈ {7 tipos}`. Dentro: lista+editor das `errorMessages` (reuso dos editores por tipo, sem Botões/Lista), `IntentSelect` (default Start), 2 rádios redirect. Estados de COLLECTION/TEMPLATE (token/loading/erro) idênticos ao editor principal.
- **Release:** CHANGELOG (Adicionado) + bump (lote atual ou novo MINOR conforme o que já estiver não-commitado).

### Fases (1 por sessão, fecha com /handoff)
> Acoplamento baixo: a Fase 1 é 100% utils testáveis (sem React), entrega a máquina pronta; a Fase 2 só consome o que a Fase 1 expôs; a Fase 3 é release + validação manual. Cada fase abre relendo só este bloco do PLANS + o handoff anterior.

- **Fase 1 — Máquina de mensagens por container + writer do `error.next` + templates (sem React, testável): ✅ CONCLUÍDA 2026-06-23.**
  - **`editIntent.ts`:** `MessageRef` ganha `container?: 'condition' | 'error'` (default `'condition'`); helper interno `saysOf(cond, container)` resolve `cond.assistant_says` ou `cond.action.error.assistant_says` (cria `error`/`assistant_says` quando ausente). Refatorar `getMessage`/`updateMessageText`/`addTextMessage`/`addMediaMessage`/`addCollectionMessage`/`addTemplateMessage`/`removeMessage` para resolver via `saysOf`. Novo `listErrorMessages(intent)` (walks `conditions → action.error.assistant_says`, mesma forma de `EditableMessage` com `container:'error'` no ref). Novo writer `setActionErrorNext(intent, condIdx, { redirect, intent, })` aplicando o acoplamento da D3 (`type:'error'`+`action:'intent'` fixos).
  - **`intentTemplates.ts`:** `canonicalError` → `redirect:'continueFlow'`+`intentBot:''` (D10); `buildKindAction` passa a chamar `canonicalError(botId)` para os **7** kinds (hoje só transfer/capture — D9).
  - **Testes (vitest):** funções de mensagem com `container:'error'` (add/remove/update caem no container de erro; cria estrutura ausente; `container` omitido = comportamento atual → não-regressão); `setActionErrorNext` (continueFlow→`intentBot:''`, waitInteraction→`<botId>`); template dos 7 kinds nasce com `action.error` em continueFlow. Alvo: `tsc` + suíte verdes. **Sem CHANGELOG/bump** (camada interna ainda não consumida).
- **Fase 2 — `ErrorActionSection` no painel + Draft + Apply: ✅ CONCLUÍDA 2026-06-23.**
  - **`Draft`:** + `errorMessages` (cópia de trabalho separada de `messages`) + `errorRedirect`/`errorIntent`. `buildDraft` inicializa de `listErrorMessages(intent)` + `cond.action.error.next` (tolerante: `redirect` default `'continueFlow'`, `intent` default `${botId}-start`).
  - **Componente `ErrorActionSection`** (`<Section title="Em caso de erro">` colapsável, gated por `kind ∈ {7 tipos}`): lista+editores das `errorMessages` (reuso dos editores por tipo **sem** Botões/Lista — D4), `IntentSelect` (default Start, `intents` do fluxo), 2 rádios redirect. Estados COLLECTION/TEMPLATE (token/loading/erro) idênticos ao editor principal.
  - **Apply:** parametrizar o diff de mensagens existente ([DetailPanel.tsx:2683-2713](src/components/DetailPanel.tsx#L2683)) por `container` e rodá-lo também para `errorMessages`; aplicar `setActionErrorNext` na condição-alvo (`ci ?? 0`). Sem gate. Alvo: `tsc` + suíte + build verdes. (Validação visual manual pendente p/ Fase 3.)
- **Fase 3 — Validação manual + release: ✅ CONCLUÍDA 2026-06-23.** Branch própria `feat/error-action-section`. Validação visual via Playwright sobre o `masterFlow.json` (5 dos 7 kinds — order/csat compartilham o mesmo `ErrorActionSection`): seção renderiza/colapsa, `IntentSelect` default Start, 2 rádios, menu "+ Adicionar Resposta" do erro **sem** Botão/Lista (D4), e **round-trip real por export** confirmando o acoplamento D3 (waitInteraction→`intentBot:<botId>`; troca p/ continueFlow→`intentBot:""`, com `type:error`/`action:intent`/`intent` preservados). `/code-review` (alto esforço) aplicou 3 correções: acoplamento `intentBot` no `applyNodeDelete` ([editFlow.ts](src/utils/editFlow.ts)); fallback de `intent` vazio no `setActionErrorNext` ([editIntent.ts](src/utils/editIntent.ts)); deduplicação `ERROR_ACTION_KINDS`→`ACTION_KINDS_WITH_ERROR` (fonte única). CHANGELOG (Adicionado) + bump **v0.25.0** (package.json + package-lock). tsc + 376 testes + build verdes. **Pendente p/ Andy:** validar com token real os caminhos COLLECTION/TEMPLATE no erro e intenções vindas da API.

### Riscos / como testar
- **Acoplamento `intentBot` (unitário, principal):** `continueFlow` → `intentBot:''`; `waitInteraction` → `intentBot:<botId>`; troca de rádio reescreve o campo.
- **Funções de mensagem com `container:'error'` (unitário):** add/remove/update caem em `action.error.assistant_says`; cria `error`/`assistant_says` quando ausentes; `container` omitido segue em `cond.assistant_says` (não-regressão).
- **Round-trip (manual):** importar os 7 kinds → editar mensagens + intenção + rádio → export bate, demais campos preservados. Importar nó com `error.next.redirect` fora dos 2 conhecidos → preservar (risco menor, só 2 valores conhecidos na plataforma); `intent` fora do fluxo → `IntentSelect` mostra "(fora do fluxo)".
- **Caminho-infeliz:** fluxo sem `start` carregada → default `${botId}-start` aparece como "(fora do fluxo)"; COLLECTION/TEMPLATE no erro sem token → CTA de token (mesmos estados do editor principal).
- **Não-regressão:** `tsc` + `vitest` + build verdes; editor de respostas normal e templates de criação seguem idênticos (transfer/capture continuam nascendo com `action.error`, agora em continueFlow).

## Contexto

O FlowViewer hoje é um **visualizador read-only**: importa o JSON de intenções de um bot
OmniChat, parseia em `src/utils/parseFlow.ts` e renderiza com `@xyflow/react` (React
Flow 12) + layout automático via Dagre. A plataforma OmniChat **não tem editor visual
nem importador/exportador de arquivo** — só uma tela Angular que edita intenção por
intenção.

Objetivo do projeto: evoluir o FlowViewer para um **editor visual** (criar nós, conectar,
editar conteúdo) capaz de gerar JSON válido e, opcionalmente, enviar direto para a
plataforma via API.

## Contrato de API descoberto (engenharia reversa do bundle + captura de rede)

Base: `https://k0yowczqxg.execute-api.us-east-1.amazonaws.com/prod`
(API Gateway AWS; o front em `app.omni.chat` chama cross-origin).

| Operação | Chamada |
|---|---|
| Listar intenções | `GET /v1/{botId}/intents?fullObject=true` → `{ "list": [intent, ...] }` |
| Salvar/criar intenção | `POST /v1/{botId}/intents/{intentId}` (body = objeto intent completo) |
| Excluir intenção | `DELETE /v1/{botId}/intents/{intentId}` |
| Mesmas rotas para | `endpoints` e `entities` (coleções irmãs de intents) |
| Bot inteiro | `POST /v1/bots` (salvar), `POST /v1/bots/duplicate`, `POST /v1/{botId}/publish`, `GET /v1/{botId}/versions/{id}` |

Headers de autenticação necessários (capturados de uma sessão real):
`authorization: Bearer <token>`, `x-parse-session-token: <token>`,
`x-parse-application-id: <app id fixo>`, `x-omnichat-platform: web`.
O token é o de sessão do usuário logado (Parse Server). **Nunca commitar tokens.**

### Fatos de schema confirmados (POST capturado vs samples de GET)

- O body do POST tem **a mesma forma** dos itens do GET — round-trip é viável.
- `id` das intenções: UUID v4. A intenção inicial usa ID especial `{botId}-start`.
- `condition.next.intent` = **objeto** `{ botId, id }`.
- `action.error.next.intent` = **string** (ID), com `intentBot` como campo irmão.
  Essa assimetria existe em GET e POST igualmente — preservar na serialização.
- Campo `advanced: { active, endpointId }` existe nos exports mais novos
  (sample02/03) e no POST; ausente no sample01 (mais antigo). Tratar como opcional,
  mas sempre emitir no POST.
- O formulário Angular envia o `action` com **todos os campos presentes**
  (nulls/defaults explícitos: `captureDataTypesCategory`, `multipleFields`,
  `lastMessageTextParams`, etc.), enquanto GETs antigos omitem alguns. Serializar
  sempre a forma completa canônica (a do POST capturado).
- Ações que referenciam `endpoints`/`entities` apontam para IDs já existentes no
  bot — o editor trata como referência, nunca cria.

Payload de referência: ver captura do POST de `aguarda_atendente` (transfer) feita
em 2026-06-11 — manter cópia **sanitizada** (sem headers) se necessário em
`samples/`.

## Arquitetura alvo

**Inverter a fonte de verdade.** Hoje: JSON → parseFlow (lossy) → nós React Flow.
Alvo: o modelo `BotIntent[]` é a fonte de verdade; o canvas é uma projeção editável.

- Cada nó guarda seu `BotIntent` cru em `node.data` (campo `raw`).
- Edição estrutural no canvas (conectar/desconectar) = patch no intent
  (`condition.next`).
- Edição de conteúdo no DetailPanel = patch nas `conditions`/`assistant_says`.
- Exportar = remontar `{ list: [...] }` a partir dos intents (originais + patches).
  Nunca reconstruir campos não editados — **preservar e aplicar patch**, não
  serializar do zero.

## masterFlow.json — fluxo de exemplo canônico (construído por partes)

> Iniciado 2026-06-22. Arquivo: [masterFlow.json](masterFlow.json) na raiz.

**Objetivo:** manter um fluxo de exemplo de referência, fiel ao formato real da plataforma OmniChat, montado incrementalmente parte a parte.

**Bot:** usa o bot de testes `2a3859ff-62d5-4c01-ae60-6ae2f812e786` (mesmo dos backups em `samples/` e do push/smoke).

**Decisões (interrogatório 2026-06-22):**
1. **Réplica fiel** do formato da plataforma (não o mínimo do parser) — para poder ir pro push real sem virar armadilha. Conjunto de campos espelhado de `samples/sample03.json` e `example.json`.
2. O `next` da mensagem **encadeia** para o nó seguinte (não é folha terminal) — formato `redirect: continueFlow / action: intent / type: context / intent:{id,botId}`.
3. Nomes/categorias: `start`·start / `mensagem_boas_vindas`·Mensagem / `encerrar`·Encerramento.
4. O encerramento usa `action.type: endConversation` **com** uma `TEXT` de despedida ("Até logo! 👋").

**Estado atual:**
- **Parte 1:** cadeia Start (`startNode`) → Mensagem "Hello world!" (`defaultNode`) → Encerrar (`endNode`).
- **Parte 2 — nós de teste (só mensagem):** cada nó documenta no `name` a referência do que testa e no corpo o texto do teste. Padrão estabelecido com `teste_contexto_palavra_chave` (`keywords:["teste"]`, `context: mensagem_boas_vindas`, corpo "Teste de Contexto + Palavra-chave", `next` folha). É standalone (gatilho por contexto+palavra-chave) → aparece como componente próprio, com aresta tracejada de contexto vinda da `mensagem_boas_vindas`.
- **Parte 3 — Anexo + Prioridade:** 4 nós standalone de mensagem (`action.none` → `defaultNode`), um por tipo de anexo, cada um com prioridade distinta: `teste_anexo_imagem_prioridade_baixa` (IMAGE, 0.25), `teste_anexo_pdf_prioridade_media` (FILE, 0.5), `teste_anexo_video_prioridade_alta` (VIDEO, 0.75), `teste_anexo_colecao_prioridade_muito_alta` (COLLECTION `collectionId:72ae0Dqbfo`, 1). Links de mídia reais fornecidos pelo Andy.
- **Parte 4 — Menu_Testes (choice/LIST) + cadeia "Teste Cabeçalho":** os 5 nós de teste tiveram `category` → `"Teste Cabeçalho"` e foram **encadeados em sequência** (contexto → imagem → pdf → vídeo → coleção → `encerrar`). Novo nó `Menu_Testes` (`action.choice` → `choiceNode`, `category: "Menu"`) com mensagem **LIST** toda preenchida (header/body/footer/título + botões com id/text/description). 3 itens: **Teste Cabeçalho** (conectado, `choices[0]` → início da cadeia) + 2 placeholders **Teste por Tipo** e **Teste por Ação** (slots `choices` vazios → aviso "sem conexão" do v0.19.0, reservados para caminhos futuros). Total: 9 intenções. `encerrar` agora é terminal compartilhado (recebe de `mensagem_boas_vindas` e da cadeia de teste). **Nota:** o JSON passou a ser formatado por `json.dump` (indent=2) a partir desta parte.
- **Parte 5 — fluxo fechado:** `mensagem_boas_vindas.next` repontado de `encerrar` → `Menu_Testes`. Agora tudo é **1 componente conexo**: `start → boas_vindas → Menu_Testes → [Teste Cabeçalho] → cadeia → encerrar`. Placeholders do menu seguem sem destino.
- **Parte 6 — Teste por Tipo (submenu de ConditionTypes):** novo nó `Menu_Tipos_Condicao` (choice/LIST, `category: "Menu"`, 8 itens), ligado a partir do botão "Teste por Tipo" do `Menu_Testes` (`choices[1]`). Para cada um dos 8 ConditionTypes que avaliam algo (`context`, `lastIntent`, `empty`, `exists`, `equals`, `contains`, `totalIsGreaterThan`, `totalIsEqual`) há um nó `teste_tipo_<slug>` (`category: "Teste por Tipo"`) com **2 condições** `[<tipo>, else]` → vira `intentGroupNode`; ambas `action.none`, com mensagem distintiva ("✅ Caiu em: <rótulo>" / "↪️ Caiu no Senão") e `next → encerrar`. Operandos placeholder: `@custom.teste` (igual="A", contém=["sim","ok"], total*="1"); `lastIntent` referencia `mensagem_boas_vindas` no campo `intent` da condição. Formas de campo por tipo espelhadas dos samples (`""` em equals/empty/contains; `null` em exists/total*). **Ajuste (Andy):** em `teste_tipo_contexto`, a condição `context` tem **`condition.context` E `condition.intent`** preenchidos com `Menu_Tipos_Condicao` (a intenção de onde o nó é alcançado). Na OmniChat o gatilho "Contexto é igual a" exige os dois campos para ser testável.
- **Parte 7 — nó Flow (TEMPLATE) na cadeia "Teste Cabeçalho":** novo nó `teste_flow` (`category: "Teste Cabeçalho"`, `action.none` → `defaultNode`) inserido **entre** `teste_anexo_colecao_prioridade_muito_alta` e `encerrar` — completa os tipos de mensagem (TEXT/IMAGE/FILE/VIDEO/COLLECTION/**TEMPLATE**). Mensagem `TEMPLATE` "Teste Flow" (`messageTemplateId: 1PytiMByYDhA`, token `@customer.name` → `{{1}}`, botão `FLOW`), modelo fornecido pelo Andy usado verbatim; `next` repontado do start (do modelo) para `encerrar` (evita laço; segue o padrão da cadeia). 19 intenções no total.
- **Parte 8 — Teste por Ação (concluída):** o 3º botão do `Menu_Testes` (`choices[2]`, "Teste por Ação") agora aponta para o novo `Menu_Acoes` (choice/LIST, `category: "Menu"`, 6 itens). Cada item percorre **exemplos das possibilidades** daquele `ActionType`. **15 nós novos → 34 intenções no total.** **Decisões (interrogatório 2026-06-22):**
  1. **Estrutura:** submenu **só na Transferência** (`Menu_Transferencia`, 6 `TransferType`s); os outros 5 ramos são **cadeias curtas** encadeadas por `next`.
  2. **Capturar informação** (`captureData`) → 2 nós: `acao_captura_um` (`captureDataType: mail`, `captureDataTypesCategory: singleField`) → `acao_captura_varios` (`captureDataTypesCategory: multipleFields`, `multipleFields` = todos os campos de dado padrão: fullName, name, mail, fullPhoneNumber, cpf, cnpj, zipcode, addressStreet, addressNumber, addressComplement, gender, birthDate).
  3. **Editar informação** (`setData`) → 2 nós: `acao_editar_um` (`bulkUpdate` 1 item) → `acao_editar_varios` (`bulkUpdate` vários). Variáveis reais padrão (`@customer.*`).
  4. **Ações sobre a loja física** (`store`) → `acao_loja` (`storeType: "first"` — único valor do enum `StoreType`).
  5. **Chamada de API** (`external`) → `acao_api` (`external: {type:"request", apiName:<placeholder>}` + bloco `error` com `next.redirect: waitInteraction` — caminho infeliz). **Placeholder obrigatório:** o bot de testes não tem nenhuma API configurada (todos os `apiName` vêm `[]`/`null`), então não existe ID real pra referenciar.
  6. **Transferência** (`transfer`) → `Menu_Transferencia` → 6 nós, um por `TransferType` (`search4group`, `direct4group`, `search4user`, `direct4user`, `directFromBranch`, `direct4userPrevious`). `value` = **IDs reais** do retailer do bot de testes (`5rFc8fXg1G`) onde aplicável: time real nos `*4group`, usuário real nos `*4user`; `directFromBranch`/`direct4userPrevious` → `value` null (resolvido em runtime).
  7. **Aguardar interação** (`waitForInteraction`) → `acao_aguardar` (`next.redirect: waitInteraction`).
  - **IDs reais (decisão do Andy):** buscados ao vivo no retailer `5rFc8fXg1G`. Times: `search4group` → `UrAnEmtASL` (Andrews Teste 1), `direct4group` → `S1Cl3fbnFG` (Financeiro). Usuários: `search4user` → `H8eCHFdDdc`, `direct4user` → `7AetrEiHgI`. `directFromBranch`/`direct4userPrevious` → `value: null` (runtime). API → placeholder `apiName: "API_EXEMPLO"` (bot não tem API configurada). setData usa `@customer.name`/`@customer.email` (reais) + `@custom.origem`.
  - **Desvio de fidelidade (transfer = folha):** os 6 nós de transferência **não encadeiam** para `encerrar` — o `next` é folha (`{redirect:"waitInteraction", type:"context"}`), como no `transfer` real dos samples: transferir entrega ao humano e o bot para ali. Encadear para `endConversation` seria contraditório.
  - `captureData`/`setData`/`store`/`external`/`transfer` carregam bloco `error` (caminho infeliz: `next.redirect:waitInteraction`, `type:error`, `intent` = `-start`), espelhado dos samples. Cada nó-exemplo tem `name` = referência + uma `TEXT` curta. `category: "Teste por Ação"`.
  - **Estrutura final:** `Menu_Acoes` ─[Capturar]→ `acao_captura_um`→`acao_captura_varios`→encerrar · ─[Editar]→ `acao_editar_um`→`acao_editar_varios`→encerrar · ─[Loja]→ `acao_loja`→encerrar · ─[API]→ `acao_api`→encerrar · ─[Transferência]→ `Menu_Transferencia`→ 6 nós (folhas) · ─[Aguardar]→ `acao_aguardar`→encerrar.
- **Parte 9 — um encerramento por grupo de categoria (limpeza do desenho):** o `encerrar` compartilhado recebia ~22 arestas de todos os ramos (emaranhado no Dagre). Dividido em **3 sinks locais** `endConversation` (todos `category: "Encerramento"`, despedida própria): `encerrar_cabecalho` (mantém o id `f19f108f…`, 1 entrada: cadeia Cabeçalho via `teste_flow`), `encerrar_tipo` (16 entradas: 8 grupos × 2 condições do "Teste por Tipo") e `encerrar_acao` (5 entradas: ramos não-transfer do "Teste por Ação"). Repontamento feito pela **categoria da intenção de origem**. **36 intenções no total.** As transferências seguem folhas (não encerram).
- **Parte 10 — 7ª opção "Transferência para outro bot" no `Menu_Transferencia`:** **não** é um `transferType`. Forma real (samples `sample02`/`sample03`): nó `acao_transfer_outro_bot` com `action.type: "none"` e `next` especial `{redirect:"waitInteraction", action:"bot", type:"context", intent:{id:"<outroBotId>-start", botId:"<outroBotId>"}}` — folha (entrega ao outro bot e este para, como as transferências humanas). Bot-alvo = **ID real** "Andrews - Cadastro de clientes" (`8df3c1e7-a8c9-4bad-ac5a-2855462da840`), outro bot do mesmo retailer (`5rFc8fXg1G`). O viewer já renderiza nativamente como nó sintético **"Outro Bot"** (`ExternalBotNode`, detectado por `parseFlow.ts` via `next.action==='bot'`), com aresta tracejada. `Menu_Transferencia` agora tem 7 itens (limite WhatsApp LIST = 10). **37 intenções no total.**

**Como foi testado:** parse JSON OK + simulação do grafo `parseFlow` (action→NodeKind e validação de que todo `next.intent.id`/`choices[]` existe na lista, ids únicos, menus 100% conectados). IDs de time/usuário da Parte 8 obtidos ao vivo (read-only, retailer `5rFc8fXg1G`, token de sessão). Pendente: validar visualmente no viewer e, se for dar push, confirmar contra a API real (em especial o nó de API com `apiName` placeholder e o `context`).

**Próximas partes:** estender a partir da Mensagem (hoje folha após o Encerrar) com novos tipos de nó conforme necessário.

## Melhorias paralelas (independentes das fases)

- ~~Trocar `dagre@0.8.5` (sem manutenção) por `@dagrejs/dagre` (fork mantido,
  API idêntica) — só muda o import em `parseFlow.ts`.~~ ✅ FEITO (2026-06-15):
  `@dagrejs/dagre@3.0.0`. O fork embarca tipos próprios, então `@types/dagre` saiu.
  Build + 100 testes + smoke-phase5 verdes; bundle caiu ~526→477 kB.
- Avaliar `elkjs` se a estética do layout automático incomodar: é port-aware
  (considera a posição dos handles, melhora fluxos com muitos botões/saídas).
  Restrito a `parseFlow.ts:dagreLayout`.

## Riscos e decisões registradas

1. API interna não documentada — pode mudar sem aviso; o teste de round-trip com
   exports reais é a rede de segurança.
2. Usuário (Andy) trabalha na OmniChat (Suporte N2 + automações) — uso interno
   autorizado, ainda assim seguir a regra do sandbox.
3. Não criar/editar `endpoints` e `entities` no escopo atual — só referenciar.
4. A skill de projeto foi descartada (decisão de 2026-06-11): o conhecimento fica
   neste PLANS.md.
5. **`npm audit`: 2 vulnerabilidades high do esbuild ≤0.28.0 — ACEITAS, não
   corrigir com `--force` (decisão de 2026-06-15).** Ambas são de tempo de
   desenvolvimento e não chegam ao site publicado (o esbuild não vai no bundle):
   (a) GHSA-67mh-4wv8-2f99 — o dev server do esbuild permite que um site
   malicioso aberto durante `npm run dev` leia respostas (vetor só em localhost,
   produção não usa); (b) GHSA-gv7w-rqvm-qjhr — falta de verificação de
   integridade do binário **no módulo Deno** (projeto é Node, não aplica). O
   esbuild ≤0.28.0 vem do **vite 5**, e o único fix que o npm oferece é
   `vite@8` (`audit fix --force`) — major quebrando vite 5→8, desproporcional
   para falhas que não atingem produção. Se um dia quiser zerar o audit, fazer
   um **upgrade deliberado do vite** como tarefa própria, com revalidação de
   build/config/plugin-react — nunca via `--force`.

## Histórico (arquivado)

> Detalhes completos em [docs/PLANS-ARCHIVE.md](docs/PLANS-ARCHIVE.md). Uma linha por fase/feature concluída e mergeada.

- **v0.24.0** — Nó "Chamada de API" editável (Tipo de Integração + picker de Endpoint)
- **v0.24.0** — Nó "Transferência" rico (seletor de 2 níveis + picker de vendedores)
- **v0.23.0** — Nó "Loja física" editável + picker dinâmico de `@entity` (Listas)
- **v0.22.0** — Próximo Fluxo (`next.intent` editável: "Neste bot" / "Em outro bot")
- **v0.20.1** — Fix `remapRefs` (refs de `context`/`condition.intent` no push)
- **v0.20.0** — Tempo de envio da resposta (`executionDelay`) — "Fase 17"
- **v0.19.0** — Fase 16: sinal de "opção de menu sem conexão" no nó de Escolha
- **v0.18.1** — Fase 15: feedback ao "Aplicar alterações" (toast + micro-animação)
- **v0.18.0** — Fase 14: nó de Captura (modos "Uma" / "Múltiplas informações")
- **v0.17.0** — Fase 13: UX do picker de variáveis (@)
- **v0.16.0** — Fase 12: Modelo de mensagem com Flow (TEMPLATE)
- **v0.15.0** — Fase 11: repaginação visual "cara de Omni" / Fase 7: duplicação de nós
- **v0.14.0** — Fase 6: nós por condição (Modelo B)
- **v0.13.0** — Fase 4: push + restore via API (CLI + UI) / Fase 5: redesign editor (v0.10–0.12)
- **v0.16.0** — Fase 10/10b/10c: mensagem Botão/Lista + nó de Escolha (menu × escolhas)
- **(branch)** — Fase 8: painel de edição alinhado ao construtor / Fase 9: variável "Times" (@team)
- **v0.8.0–0.9.0** — Fase 3a/3b: edição de conteúdo + estrutural avançada
- **v0.7.0** — Fase 2: criação de nós (paleta + templates)
- **v0.6.0** — Fase 1: round-trip (importar → reconectar → exportar)
