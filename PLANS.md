# PLANS.md — FlowViewer: de visualizador a editor de fluxos OmniChat

<!-- HANDOFF:START -->
## 🔄 Handoff — 2026-07-14 (`/verify` e2e das Fases B/A contra API real + fix no fixture; NÃO commitado)

**Foco da próxima sessão:** **commitar o fix do fixture** (numa branch, não na `main`) e decidir 2 pendências abertas (abaixo). Verificação e2e das features do agente está essencialmente fechada.

**Onde paramos:** rodei o `/verify` e2e pendente das features já mergeadas, dirigindo as **tools MCP** (o mesmo surface do agente) contra a **API real** da loja de teste. Andy liberou o time **"Andrews Teste 1"** (destravou o `set_transfer`, que exigia time real). Resultados: **Fase B (`set_transfer`) e Fase A (limites de menu) e2e-VERDES** — happy-path (`group/simple "Andrews Teste 1"` → `direct4group` + objectId real) e todos os caminhos-infelizes (time inexistente/ambíguo → erro sem gravar; `set_action_field transferType` → erro-guia; nó não-transfer → erro; item >20 e body >80 → hard-block; nudge de keyword-com-espaço e nudges de menu legado no `validate()`). **Achei e corrigi um defeito**: o fixture canônico `public/masterFlow.json` tinha 2 campos de menu acima dos limites que a Fase A passou a impor (o próprio app rejeitaria o exemplo). Trim mínimo de 2 linhas; confirmado em runtime (nudges sumiram) e regressão verde (`flowTools.test.ts` 89/89).

**Fios soltos / meio-feito:** **`public/masterFlow.json` está não-commitado** (o fix de 2 linhas — descrição do item 3 de `Menu_Testes` 83→63; texto do item 2 de `Menu_Tipos_Condicao` 21→19). Precisa: branch + commit (`fix:` ou `chore:`) + nota no CHANGELOG. **2 decisões abertas** que perguntei e ficaram sem resposta antes do `/handoff`: (a) rodar ou não um spot-check de *happy-path* da Fase 2.1 no Playwright — **recomendei NÃO**: a garantia-raiz da Fase 2.1 (não gravar `updatedAt` fantasma em irmão não-editado) é estado interno, não observável por pixel, e já tem 14 unit tests verdes; (b) atualizar o corpo do PLANS marcando Fase B/A como e2e-verificadas e a Fase 2.1 como "core coberto por unit; UI opcional". `.claude/settings.local.json` e `PLANS.md` seguem modificados fora dos commits (como sempre).

**Armadilhas desta sessão:** (1) **MCP carrega o FLOW_FILE em memória UMA vez** ([mcp/server.ts:53](mcp/server.ts#L53)) — editar `masterFlow.json` no disco é invisível ao MCP em execução; para observar, use `FlowStore.fromFile` fresco (mesmo par do [:280](mcp/server.ts#L280)) ou reinicie o MCP. (2) **O MCP reserializa com LF; o repo é CRLF** — qualquer sessão que escreve pelo MCP deixa `masterFlow.json` "modificado" mesmo após `revert`; conteúdo é byte-idêntico módulo EOL, restaure com `git checkout --`. (3) `set_menu` **recusa sobrescrever** menu já existente ("já tem menu/destinos definidos"). (4) Token de sessão Parse em `flow-viewer.env` estava **válido** nesta sessão, mas expira rápido — se der 401/403, renovar (sem retry).

**Próximo passo imediato:** `git switch -c fix/masterflow-menu-limits`, commitar o fix de `public/masterFlow.json` + CHANGELOG (`Fixed`), abrir PR. **Confirmar antes:** `git diff --numstat public/masterFlow.json` deve ser `2 2` (só as 2 linhas; se vier o arquivo todo, é EOL — refazer só as 2 linhas preservando CRLF).

**Ponteiros:** features verificadas — agora arquivadas em [docs/PLANS-ARCHIVE.md](docs/PLANS-ARCHIVE.md) (Fase 2.1 v0.33.0, Fase A v0.34.0, Fase B v0.35.0 PR #10 `16ce33d`; PLANS.md arquivado nesta sessão por já estarem concluídas/mergeadas). Fix no fixture: [public/masterFlow.json](public/masterFlow.json) itens de `Menu_Testes`/`Menu_Tipos_Condicao`. Resolução de time: `find_team` ao vivo (token em `flow-viewer.env`; ver [memória OMNI_TOKEN]). MCP: [.mcp.json](.mcp.json) `FLOW_FILE=public/masterFlow.json`. Pendências herdadas ainda vivas: prompt de lojista de teste (removido do repo por conter dado de cliente real — ver repo pessoal) nunca rodado fim-a-fim; §"Fase 5" (produto).

**Skills sugeridas:** `/code-review` antes de commitar o fix; `/verify` só se for fazer o spot-check de UI da Fase 2.1 (baixo valor, ver acima); `/interrogar` antes de codar feature nova.
<!-- HANDOFF:END -->

## Migração para o ecossistema de dev da Omnichat (marketplace · PR · CHANGELOG)

> Iniciada em 2026-07-16. Distinta da migração *técnica da aplicação* descrita em
> [docs/GUIA-DE-MIGRACAO.md](docs/GUIA-DE-MIGRACAO.md) (auth/endpoints/hosting). Esta trata do
> **processo/ferramental de desenvolvimento**: adotar o marketplace de skills, o padrão de PR e o
> formato de CHANGELOG da Omnichat.

**Fonte de verdade:** repo privado `OmniChat/omnichat-claude-marketplace` (diretrizes em
`CLAUDE.md`/`README.md` + 2 plugins). Ver [memória `reference_omnichat_marketplace`].

**Decisões travadas (sessão 2026-07-16):**
- Marketplace registrado no **`.claude/settings.json` versionado** (compartilhado com o time,
  conforme o README do marketplace) via `extraKnownMarketplaces`. Habilitação dos plugins é ação
  do usuário.
- **Jira adiado** — o Fluxo ainda não tem projeto Jira; o CHANGELOG e o fluxo de PR foram
  **adaptados** para operar sem Jira (referência via PR do GitHub). Retomar formato completo
  quando um projeto Jira for definido.
- **Nunca** push/PR sem confirmação explícita (ver memória `feedback_never_push_without_confirmation`).

**Feito (✅):**
- Marketplace registrado no `.claude/settings.json` (versionado); skills `abrir-pr-omnichat` e
  `web-app-code-review` disponíveis (esta última é do web-app Angular, não se aplica ao Fluxo).
- CHANGELOG legado (formato Keep a Changelog, pt, até v0.36.0) arquivado **verbatim** em
  [docs/CHANGELOG-ARCHIVE.md](docs/CHANGELOG-ARCHIVE.md); [CHANGELOG.md](CHANGELOG.md) recriado no
  padrão Omnichat adaptado (inglês, sem Jira, baseline v0.36.0).
- Branch **`devel`** criada localmente a partir de `origin/main` (push pendente de confirmação).

**Pendências / próximos passos:**
- **Push da `devel`** para o remote (confirmar) — pré-requisito da skill `abrir-pr-omnichat`,
  que abre PRs simultâneos para `main` + `devel`.
- Definir se/quando adotar Jira (retoma o formato completo de CHANGELOG e a criação de task no PR).
- Commitar as mudanças desta sessão (CHANGELOG + archive + PLANS) numa branch — **sem push sem OK**.

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

## Agente de IA que constrói nós (Claude Code CLI + servidor MCP local)

> Promovido do handoff em 2026-06-23 após interrogatório (skill `interrogar`). Esta é a
> **feature-foco** das próximas sessões; o handoff no topo aponta pra cá. O masterFlow
> (parado/completo na Parte 12) deixa de ser o foco.

**Objetivo (1 frase):** um agente de IA que **constrói e edita nós do fluxo operando
ferramentas** (nunca escrevendo JSON cru), via **Claude Code CLI + um servidor MCP local**
sobre o arquivo de fluxo, estruturado desde já para virar produto depois.

**Decisões-âncora (travadas no design original — NÃO reabrir):**
- O agente **opera tools, nunca escreve JSON cru**. As tools envolvem as funções que já
  existem; a validade fica no código, não na memória do modelo.
- O **servidor MCP é a peça durável** — o mesmo conjunto de tools é reusado no
  caminho-produto; só troca o cliente.
- **Local:** Claude Code lança o MCP como **subprocesso por stdio** — zero portas, zero
  rede de entrada. Único tráfego é **de saída** (API Anthropic + API OmniChat). O gh-pages
  **NÃO** fala com o MCP — site e agente são ilhas que só se cruzam pelo **arquivo de fluxo
  em disco** (a UI lê o arquivo só sob demanda via "Carregar exemplo"/import — ela NÃO o lê
  ao vivo; ver [ImportDialog.tsx:27](src/components/ImportDialog.tsx#L27)).
- **Token** vive na **camada de tools** (`OMNI_TOKEN` de `flow-viewer.env`), nunca chega ao
  modelo, nunca é logado. **Resolver por nome → gravar por ID** (o ID sempre vem de resposta
  real da API ⇒ mata referência alucinada).
- **Modelo:** default `claude-sonnet-4-6`; subir p/ `claude-opus-4-8` se errar a sequência
  em pedidos compostos.

**Ordem revista (interrogatório 2026-06-23, Q1 — spike-primeiro).** O refactor do catálogo
(antiga Fase A) foi **adiado para depois do spike**: provar o conceito contra fluxos reais
antes do refactor caro que toca o [DetailPanel.tsx](src/components/DetailPanel.tsx) (~3500
linhas, 383 testes — o arquivo mais arriscado). De-risca e respeita "amostra mínima antes de
escalar". Nova ordem: **1 spike → 2 catálogo → 3 MCP → 4 resolvers → 5 produto.**

> **Fases 1, 2, 3, 4 e 4b ✅ concluídas e mergeadas na `main`** (spike: merge `15cbf54`;
> Fase 2: merge `e701026`; ambos 2026-06-24). Detalhes do spike (Fases 1/3/4/4b) **e da Fase 2
> (`NODE_CATALOG`)** em [docs/PLANS-ARCHIVE.md](docs/PLANS-ARCHIVE.md) — a Fase 2 foi migrada ao
> archive em 2026-06-26 (PLANS passou de ~600 linhas). Segue viva abaixo apenas a **Fase 5**
> (produto, direcional).

### Fase 5 — Produto (direcional, NÃO detalhar agora)

Cliente Claude Code → **backend** com tool runner do SDK (ou MCP connector); o **frontend
executa as tools via relay** (WebSocket/SSE) para a **key ficar no servidor**. Backend em
nuvem (Render/Fly/Workers), **nunca** no roteador de casa; gh-pages segue só frontend.

**Não detalhar agora (Q10):** depende de decisões de produto ainda não tomadas (hosting,
transporte do relay, modelo de auth do usuário final) — detalhar seria especulação que
envelhece mal. O que importa preservar **já são anchors**: camada de tools agnóstica de
transporte, token na camada de tools, **storage abstrato** (reforçado pela Q3). Enquanto as
Fases 1–4 respeitarem isso, a Fase 5 segue viável.

**Riscos/pendências:**
- Pureza Node das funções confirmada (só tipos) — re-verificar se algo puxar novas
  deps de browser para `src/utils`.
- API interna não documentada (risco já registrado) — o round-trip real é a rede de
  segurança.

### Prompt de construção de fluxo de lojista (exercício com PDF de cliente real)

> Prompt multi-turno fechado por interrogatório (skill `interrogar`) em 2026-06-26. Removido do
> repo (continha dado de cliente real) — artefato completo preservado só no repo pessoal.
> **Gap de tool descoberto**, que segue válido independente do exercício: intenção dentro/fora-de-
> horário com "Senão" exige tools de condição inexistentes (add_condition + critério
> `@bot.isOpenNow` + flag Senão) — candidato a feature futura.

## Melhorias paralelas (independentes das fases)

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

- **PR #13 (merge `d4cb026`)** — Fonte única de configuração de API (dedup `API`/`APP_ID`/headers entre `pushFlow.ts` e `teams.ts` — "metade 1")
- **v0.36.0 (PR #12)** — Redesign do widget do agente: botão-menu + expansão animada + janela redimensionável
- **v0.35.0 (PR #10, merge `16ce33d`)** — Fase B: `set_transfer` preenche a Transferência de verdade (enum + objectId resolvido)
- **v0.34.0** — Fase A: limites de caractere do Menu (nó de Escolha) — `MENU_LIMITS` + hard-block + nudge
- **v0.33.0 (branch `feat/menu-keywords-routing`)** — Fase 2.1: correções pós-code-review do roteamento de Escolhas (gatilho "editou-desde-a-abertura", keyword multi-palavra, nudges)
- **(2026-06-15)** — Fork `@dagrejs/dagre@3.0.0` no lugar do `dagre@0.8.5` sem manutenção (API idêntica, `@types/dagre` removido)
- **v0.33.0 (PR #6, merge `d59d6ae`)** — Menus que roteiam de verdade (`set_keywords` + `set_context` + UI por opção, Fases 1+2)
- **v0.32.0 (PR #6, merge `d59d6ae`)** — Categorias coerentes nos nós (`set_category` + semente + nudge)
- **v0.31.0 (PR #6, merge `d59d6ae`)** — Nó de Captura no agente (`captureNode` via guidance + nudge)
- **v0.30.0 (PR #5, merge `53b3b19`)** — Chat UX: textarea auto-expand + pill zinc + widget draggable
- **v0.30.0 (PR #5, merge `53b3b19`)** — Gate da caixinha de chat (lock + popover de requisitos pendentes)
- **(merge `15cbf54`, PR #5)** — Caixinha de chat na página: PoC local do agente (Claude Agent SDK + ponte WS)
- **(merge `15cbf54`)** — Tool `set_message`: texto TEXT do `defaultNode` (0→cria, 1→sobrescreve, N>1→erro)
- **(merge `15cbf54`)** — Spike MCP: Fases 1/3/4/4b (camada de tools, servidor MCP stdio, 8 resolvers nome→ID, set_menu + connect_to_bot)
- **(merge `e701026`)** — Fase 2: centralizar `NODE_CATALOG` (fonte única kind-level; MCP deriva o manifesto)
- **v0.27.0** — Nó Captura CSAT editável (dropdown "Tipo de captura CSAT")
- **v0.26.0** — Nó Pedido editável (dropdown "Tipo de ação": Adicionar item / Gerar pedido)
- **masterFlow.json** — fluxo de exemplo canônico, Partes 1–12 (42 intenções) — fixture viva em `public/masterFlow.json`
- **v0.25.0** — Seção "Em caso de erro" (`action.error`) nos 7 nós de ação
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
