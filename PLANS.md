# PLANS.md — FlowViewer: de visualizador a editor de fluxos OmniChat

<!-- HANDOFF:START -->
## 🔄 Handoff — 2026-07-06 (Redesign do widget do agente MERGEADO como v0.36.0)

**Foco da próxima sessão:** feature do widget **fechada** — sem trabalho pendente nela. Retomar as **pendências herdadas** (abaixo) ou o próximo item do backlog.

**Onde paramos:** PR **#12** (`feat/agent-widget-redesign` → `main`) **mergeado como v0.36.0**. Fecha o Redesign do widget (decisões 1–7): âncora topo-direito + expansão animada (1/2/5), botão-menu `bg-zinc-950` + `StatusWaves` (3/4), janela redimensionável pela alça inferior-esquerda mantendo o canto superior-direito fixo (6/7), e o polimento final desta série — header do painel com a cor do menu, renome **"Flow Agent"**/"Agent" e `StatusWaves` também no header. CHANGELOG bumpado: seção `## [0.36.0]` (widget) + `## [0.35.0]` (set_transfer, que estava solta em [Não lançado] por um lapso do merge do PR #10). `package.json` → 0.36.0. `tsc` limpo; suíte **581 verde**.

**Fios soltos / meio-feito:** nenhum na feature do widget. Pendências herdadas (seguem vivas, independentes): `/verify` e2e da Fase 2.1; prompts Fluent School/Grupo Uni.co nunca rodados fim-a-fim; times do fixture Fluent School não existem na loja de teste (só "Financeiro"). `.claude/settings.local.json` segue modificado e **fora** dos commits (intencional, como sempre).

**Armadilhas (referência do widget, se voltar a mexer):**
- **Resize × transição de expansão:** o wrapper tem `transition: width/height 320ms`. Sem desligá-la durante o arraste, a alça criava **rubber-band**. Solução: `transition: resizing ? 'none' : …`. Preservar esse gate.
- **Piso do resize = `computePanelSize()`, NÃO 400×600 fixo:** em viewport estreita o default já vem clampado a 92vw/80vh; piso fixo quebraria telas pequenas (piso > teto). Por isso `useResizable` recebe o mín recomputado por render.
- **`/verify` do widget (Playwright):** rail são botões-ícone por `aria-label`. `getByLabel('Importar',{exact})` → `getByText('Carregar exemplo')` → `getByLabel('Token',{exact})` → preencher `input[type=password]` → `Escape` → clicar o backdrop `div.fixed.inset-0.z-40`. Painel monta sempre (cross-fade); a alça `getByLabel('Redimensionar o agente')` existe no DOM já aberto.

**Ponteiros:** PR #12 (merge na `main`). Feature no corpo do PLANS §"Redesign do widget do agente… ✅ IMPLEMENTADA". Arquivos: [useResizable.ts](src/hooks/useResizable.ts) + [useResizable.test.ts](src/hooks/useResizable.test.ts), [useDraggable.ts](src/hooks/useDraggable.ts), [ChatPanel.tsx](src/components/ChatPanel.tsx). CHANGELOG §[0.36.0].

**Skills sugeridas ao retomar:** `/verify` para as pendências herdadas (Fase 2.1 e2e, prompts Fluent School/Uni.co) quando forem retomadas.
<!-- HANDOFF:END -->

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
- ~~O refactor do `NODE_CATALOG` (Fase 2) arrisca os 383 testes do DetailPanel.~~ ✅ Resolvido:
  Fase 2 mergeada (merge `e701026`) com a suíte verde como gate em cada um dos 4 commits.

### Prompt de construção do fluxo "Grupo Uni.co (lojista)"

> Prompt multi-turno fechado por interrogatório (skill `interrogar`) em 2026-06-26. Artefato
> reutilizável: 6 turnos de chat + mapa Mermaid + critério em
> [docs/PROMPT-fluxo-uni-co.md](docs/PROMPT-fluxo-uni-co.md). Origem: PDF "Reestruturação
> Omnichat Lojista".

**Objetivo:** construir pela caixinha o fluxo do PDF **o mais fiel possível**, dentro das tools.
Topologia: tronco linear (saudação→marca→captura CNPJ→categoria→assunto de 7 opções) + os 7
direcionamentos, com **bifurcação local (menu)** só nos ramos 2 (devolução, por marca×categoria)
e 6 (partes/peças, por marca) — porque **não há condição por variável nas tools**. Dinâmicos →
variáveis reais (`@customer.name`, `@chat.customerSupportRequestId`). Serve também de `/verify`
do `set_message`. **Gap de tool descoberto:** intenção dentro/fora-de-horário com "Senão" exige
tools de condição inexistentes (add_condition + critério `@bot.isOpenNow` + flag Senão) — fora-de-
horário virou 2 nós soltos como aproximação; candidato a feature futura. Pendente: rodar pela
caixinha e avaliar contra o critério do doc.

### Correções pós-code-review da Fase 2 (Fase 2.1) ✅ IMPLEMENTADA (v0.33.0, branch `feat/menu-keywords-routing`)

> **Resultado (2026-06-30):** entregue. Gatilho de escrita de `applyChoiceRouting` trocado para
> "editou-desde-a-abertura" (snapshot `initialKeyword`/`initialContextOn` DENTRO do `ChoiceMeta`,
> congelado em `choiceMetaOf`) — dissolve #2/#3/#5/#9. `KeywordTags.commit` splita por espaço
> (`splitKeywordInput`, exportado p/ teste); nudge "keyword com espaço" no `findKeywordNudges`;
> hint inline de destino duplicado (`duplicateDestHints`); `console.warn` em ref órfã (#6);
> `touch()` no `setCategory` (#7); comentário no `beginMutation`/self-ref do `setContext` (#8).
> **+14 testes** ([DetailPanel.routing.test.ts](src/components/DetailPanel.routing.test.ts) reescrito p/ a nova forma +
> `duplicateDestHints`/`splitKeywordInput`; [flowTools.test.ts](src/tools/flowTools.test.ts): nudge multi-palavra +
> `set_category`→`updatedAt`). Suíte cheia **528 verde**, `tsc`+`mcp:typecheck` limpos. **Pendente:** `/verify` e2e.
>
> `/code-review` (high) da Fase 2 + interrogatório (skill `interrogar`) em 2026-06-30. O review achou
> 10 itens; estes são os 3 de correctness de maior risco em `applyChoiceRouting` (escrita cross-intent),
> nenhum coberto pelos testes atuais (que só conferem valor final, nunca `updatedAt` nem colisão/wipe).
> Decisões TRAVADAS abaixo. A correção de raiz dissolve #2/#3/#4/#5 e o cleanup #9 de uma vez.

**Bugs (no `applyChoiceRouting`, [DetailPanel.tsx:460](src/components/DetailPanel.tsx#L460)):**
- **#1** — dois itens de menu ao MESMO alvo → clobber silencioso de keyword (last-write-wins); `IntentSelect`
  não impede destino repetido (só filtra o próprio nó).
- **#2** — `context ON` regrava incondicional ([:480](src/components/DetailPanel.tsx#L480)), bumpando
  `updatedAt`/histórico de irmão NÃO editado — assimetria com o ramo de keyword (que tem guarda).
- **#3** — meta vazia pode APAGAR keyword viva do alvo (`desired=[]` vs `current=[kw]` → `setIntentKeywords(target, [])`).
  Caminho de **desync** é seguro (meta `undefined` → `if (!meta) return`, pula); o real é **stale-prop**
  (painel abre com snapshot de `intents`, prop muda sem rebuild do draft, alvo já tem keyword no apply) — estreito.

**Decisão-raiz: gatilho de escrita = "editou-desde-a-abertura" (não "difere do alvo vivo").** Guardar a
`choiceMeta` pré-preenchida na abertura (`choiceMetaInitial`, congelada no `buildDraft` e re-congelada no rebuild
pós-apply) e gravar SÓ os campos cuja meta ATUAL difere da INICIAL — comparando string-crua × string-crua, fora
da normalização. **Por quê:** o gatilho atual confunde "o humano editou?" com "está diferente do estado vivo?";
contra um alvo cujo estado vivo divergiu do que o painel mostrou, isso gera escrita fantasma. O snapshot estável
é a intenção real do usuário. **Consequências:** (a) **#2** some — checkbox não tocado não grava; (b) **#3** some
— meta defasada = não-editada → nunca dispara wipe; (c) **#5** vira não-problema — o `commit` do `KeywordTags`
([:638](src/components/DetailPanel.tsx#L638)) já deduplica, então `'vendas, vendas'` é inalcançável pela UI; (d)
**#9** (higiene duplicada) dissolve — `norm` sai do `applyChoiceRouting`, só `setIntentKeywords` higieniza no write;
(e) "Aplicar" sem tocar nas Escolhas vira no-op real sobre irmãos (alinha com a decisão 3); (f) limpar keyword de
propósito (initial=`['x']`, agora=`''`) continua gravando `[]`. O snapshot `initial` mora DENTRO do `choiceMeta`
(ver decisão #10) + 1 param em `applyChoiceRouting`.

**Decisão #1: hint inline não-bloqueante quando 2+ opções vão ao mesmo destino.** Aviso leve no campo
("mesmo destino da Opção N — a palavra-chave é compartilhada"). **Por quê:** dois botões → uma intenção é
topologia legítima (keyword mora no alvo, match "contém"); bloquear no seletor mata o caso válido. Pós-gatilho-novo
o clobber só sobra se o humano editar AMBAS as opções do mesmo alvo a valores divergentes (raro) — o hint tira o
"silencioso". `validate()` NÃO pega (pós-apply existe só um conjunto de keywords no alvo) → tem que ser hint de UI.
Opções dentro do MESMO menu compartilham o `choiceNode.id` → sem conflito de `context` entre elas; o conflito de
context real é só cross-menu, já coberto pela guarda `else if (target.context === choiceNode.id)`.

**Decisão #4/#5 — keyword multi-palavra é INVÁLIDA na plataforma (só casa palavra individual; território N2 do Andy):**
o #4 não era sobre espaçamento — `"plano premium"` está errado com 1 ou 2 espaços; o certo é `"plano"` + `"premium"`
separados. Por isso (a) a comparação do gatilho é **string-crua × inicial** (a mais simples; o caso "consertar espaço
duplo" é irrelevante, pois multi-palavra é sempre inválido); (b) **#5 é não-problema** (dedup no `commit` do `KeywordTags`).
**Tratamento = prevenir na UI + sinalizar residual:**
- **Prevenir (type-time):** `KeywordTags.commit` ([:638](src/components/DetailPanel.tsx#L638)) passa a tratar ESPAÇO
  como delimitador (split por `/[\s,]+/`, + espaço nas teclas de commit) → digitar `"plano premium"` vira dois chips
  na hora (feedback visível, não é surpresa silenciosa). Torna o estado inválido impossível de CRIAR pela UI. Afeta
  também o campo de keyword da meta — correto, multi-palavra é inválido em qualquer keyword. O **display** (`tags`)
  segue split só por vírgula, exibindo fielmente um keyword legado `"plano premium"` como UM chip (não esconde o estado ruim).
- **Sinalizar (residual import/agente):** `findKeywordNudges` no `validate()` ([flowTools.ts](src/tools/flowTools.ts))
  ganha aviso não-bloqueante quando uma keyword contém espaço (`kw.includes(' ')`) — pega o que entrou por import de JSON
  ou pelo agente (que não passa pela UI). + hint inline amber na opção da Escolha quando o chip exibido tem espaço
  (espelha o hint "sem palavra-chave" já existente).
- **`setIntentKeywords` NÃO splita** (mantém só trim/colapsa): split silencioso no setter puro seria surpresa na camada
  de dados (a decisão 3 do `set_category` rejeitou auto-canonicalizar). A prevenção é da UI; o nudge é a rede cross-path.

**Decisões dos achados menores (#6/#7/#8/#10):**
- **#10 — estrutura do `choiceMeta` (não colapsar agora).** `ChoiceMeta` vira `{ keyword, contextOn, initialKeyword,
  initialContextOn }` — o snapshot `initial` mora DENTRO do objeto, sem criar um 3º array paralelo. `initial*` são
  congelados no `buildDraft` (abertura/rebuild) e re-baseados no `setChoiceDest` (trocar destino = novo ponto-zero);
  `setChoiceKeyword`/`toggleChoiceContext` NUNCA os tocam. Mantém as 2 estruturas de hoje (`choices` + `choiceMeta`),
  mesmo alinhamento manual já estável — **não conserta o #10, mas não o piora** (evita o 3º array). O **colapso total**
  (array único de `{ destId, keyword, contextOn, initial* }`, derivando `choices` no apply) fica como **cleanup futuro
  opcional** — desproporcional ao risco no DetailPanel (~3500 linhas) agora.
- **#6 — `return` silencioso (`if (!target || !meta)`).** `console.warn` no caso `!target` com `destId` (ref órfã: alvo
  inexistente em `intents` → "roteamento ignorado") — atende o CLAUDE.md ("logs sempre que couber") sem ruído de UI; o
  sinal ao usuário já vem do "opção sem conexão" (v0.19.0). `!meta` segue silencioso COM comentário: é o guard de
  alinhamento (#10), pular é o caminho seguro (= o que torna o #3 inofensivo), não é erro.
- **#7 — `touch()`/`updatedAt`.** O `touch()` novo em `setIntentKeywords`/`setIntentContext` é **correto** (write honesto;
  o inline antigo é que sub-tocava). Uniformizar: **adicionar `touch()` ao `setCategory`** ([flowTools.ts:205](src/tools/flowTools.ts#L205)),
  hoje sem touch — todo setter de campo de cabeçalho passa a refletir em `updatedAt`. Sem conflito com o gatilho da Fase 2.1
  (lá quem decide SE chama o setter é o `applyChoiceRouting`; quando chamado, tocar é certo).
- **#8 — `beginMutation()` no caminho rejeitado de self-ref (`setContext`).** **Aceitar** — inofensivo: `beginMutation` é
  idempotente ([flowStore.ts:77-79](src/tools/flowStore.ts#L77-L79)), snapshot só na 1ª mutação = base da sessão; um self-ref
  recusado captura o estado inalterado (base correta), `revert` segue íntegro, no máximo um `.bak` de estado inalterado.
  Só comentar o porquê. **Não** pré-checar antes do `beginMutation` — reintroduziria a duplicação da guarda que centralizamos
  no `setIntentContext`, por ganho nulo.

**Como será testado:**
- **Unit** ([DetailPanel.routing.test.ts](src/components/DetailPanel.routing.test.ts)) ganha o param `choiceMetaInitial`
  e os casos: meta == inicial → NÃO grava nem bumpa `updatedAt` (#2/#3) · context inalterado → não regrava (#2) ·
  keyword esvaziada de propósito → limpa.
- **Hint de destino duplicado:** teste de lógica pura da detecção (helper que mapeia índice → "duplicado de N").
- **`KeywordTags` split por espaço:** unit de que `commit('plano premium')` produz dois termos (`'plano, premium'`);
  espaço/Enter/vírgula confirmam; display de valor legado com espaço continua um chip.
- **Nudge multi-palavra** ([flowTools.test.ts](src/tools/flowTools.test.ts)): keyword com espaço → **dispara** ·
  keyword de uma palavra → **não** · não-bloqueante.
- **`setCategory` toca `updatedAt`** (#7, [flowTools.test.ts](src/tools/flowTools.test.ts)): `set_category` bumpa `updatedAt`.
- **Re-rodar a suíte cheia** como gate de não-regressão.

### Agente respeita as regras: limites do Menu + Transferência de verdade (v0.34.0 + v0.35.0 — ✅ IMPLEMENTADA e mergeada)

> Plano fechado por interrogatório (skill `interrogar`) em 2026-07-03. Decisões TRAVADAS abaixo —
> registro do raciocínio; não reabrir sem novo interrogatório. Origem: rodando o prompt "Fluent
> School" (escola de idiomas, 2 fases — guardado como fixture do `/verify` e2e), o agente (1) criou
> itens de menu acima do limite de caracteres sem ninguém acusar e (2) preencheu o nó de Transferência
> com `transferType="team"` (valor inventado, fora do enum) em vez de resolver o time real.
>
> **Duas fases independentes (baixo acoplamento — não se cruzam).** Cada uma shippável sozinha (uma versão).

**Objetivo (1 frase):** o agente passa a **respeitar os limites de caractere do Menu** (WhatsApp) e a
**preencher o nó de Transferência de verdade** (tipo válido dos 6 + destino resolvido por ID), com o
`validate()` acusando as recidivas.

#### Fase A — Limites de caractere do Menu (nó de Escolha) ✅ IMPLEMENTADA (v0.34.0)

> **Resultado (2026-07-03):** entregue. Fonte única `MENU_LIMITS` em [src/utils/menuLimits.ts](src/utils/menuLimits.ts)
> + `findMenuLimitViolations`; hard-block no `buildButtonList`; nudge `findMenuLimitNudges` no `validate()`; guidance no
> `choiceNode` do `nodeCatalog`; `BL_LIMITS` do DetailPanel virou alias da fonte única. **+11 testes**, suíte cheia
> **539 verde**, `tsc`+`mcp:typecheck` limpos.
>
> **Correção do plano (drift pego no /handon):** os valores NÃO são o WhatsApp cru "por tipo" que o interrogatório
> travou (body 1024 · título 24 · item 20/24). São os do **builder real da OmniChat** já codificados no `BL_LIMITS`
> da UI e confirmados pela [memória de limites](../memory): **body 80 · título 20 · item 20 FIXO** (BUTTON e LIST) ·
> header 60 · footer 60 · desc 72. Motivo: "o real vence o documento" — o que a plataforma de fato rejeita é o builder,
> não o WhatsApp cru. Decidido por Andy no início desta sessão. **Consequência para o /verify:** os itens do fixture
> Fluent School ("Falar com um consultor"=22, "Quero ver outras opções"=23) agora são **INVÁLIDOS** (>20) — ao rodar
> o e2e, ou encurtar esses itens no prompt, ou esperar o hard-block disparar. O `maxLength` da UI (decisão #4 do plano)
> **já existia** desde a Fase 10 (`CharField`); só faltava a extração p/ fonte única + o caminho do agente.

**Diagnóstico (achado do código):** `buildButtonList` ([editIntent.ts:429](src/utils/editIntent.ts#L429)),
compartilhado por `set_menu` (agente) e `replaceButtonListMessage` (UI), **valida estrutura** (≥1 item,
≤10 itens, item com texto, body não-vazio — [:434-437](src/utils/editIntent.ts#L434-L437)) mas **não
valida NENHUM limite de caractere**. Nenhuma constante de limite existe no caminho do menu.

**Decisões (com o porquê):**
1. **Contrato = padrão WhatsApp POR TIPO (Q2).** Item de menu = **20 (BUTTON) / 24 (linha de LIST)**;
   demais campos: **header 60 · body 1024 · footer 60 · título de seção 24 · descrição de linha 72**.
   O limite do item depende do `msgType`, então a checagem roda **depois** que `buildButtonList` decide
   BUTTON vs LIST (natural — é lá que o tipo é calculado). *Consequência:* os itens do teste ("Falar com
   um consultor"=22, "Quero ver outras opções"=23) num menu de 4 opções (LIST) são **válidos** (≤24) —
   a regra pega o real overflow (BUTTON >20 ou qualquer campo acima da tabela).
2. **Imposição = hard-block no `buildButtonList` + nudge no `validate()` (Q3).** Recusa criar/salvar campo
   acima do limite **dentro** do `buildButtonList` — um ponto só cobre agente E UI, **coerente com o
   `>10 itens` já existente** (mesma família "o WhatsApp rejeita"). O nudge no `validate()` pega menus
   **legados/importados** (criados antes da regra). **Por quê hard e não só nudge:** limite de caractere
   é restrição estrutural (a plataforma rejeita), não política de design — igual à contagem de itens.
3. **Escopo = TODOS os campos, tabela-constante única (Q4).** Uma constante com a tabela WhatsApp, fonte
   única, valida header/body/footer/título/item/descrição. Barato (o `buildButtonList` já monta cada um)
   e evita que a próxima reclamação seja outro campo estourando.
4. **UI = `maxLength` nos inputs do DetailPanel (Q4).** Como o `buildButtonList` passa a recusar no
   "Aplicar", o `maxLength` evita a surpresa de erro-ao-salvar (o humano não digita além do limite).
   Toca o arquivo mais arriscado (~3500 linhas) — fatiar com cuidado.
5. **Guidance no `nodeCatalog`/instructions.** O agente já manda dentro do limite (metade do pedido "o
   Agente precisa respeitar"); o hard-block é a rede quando a guidance falha.

**Como será testado (Fase A):**
- **Unit** ([editIntent.test.ts](src/utils/editIntent.test.ts)): item 21 chars em menu que vira BUTTON →
  **recusa**; item 24 em menu LIST → **passa**; item 25 em LIST → **recusa**; header 61 → **recusa**;
  cada campo no seu limite exato. Nudge do `validate()` ([flowTools.test.ts](src/tools/flowTools.test.ts)):
  menu legado com item acima do limite → **dispara**; dentro → **não**; não-bloqueante.
- **`mcp:typecheck`** limpo.
- **`/verify` e2e (fixture Fluent School):** rodar o prompt; assert que nenhum item/campo excede a tabela
  (e, se algum menu for BUTTON com item >20, que a tool recusou).

#### Fase B — `set_transfer`: preencher a Transferência de verdade ✅ IMPLEMENTADA (v0.35.0, PR #10, merge `16ce33d`)

> **Resultado (2026-07-06):** entregue e mergeada. Tool `set_transfer` + fonte única `transfer.ts` +
> `transferType` removido de `ACTION_FIELDS` (erro-guia) + nudge `findTransferNudges`. `/verify` e2e ao
> vivo (tools MCP, `OMNI_TOKEN` contra a loja de teste) confirmou: `direct4group` com `value`=objectId real,
> zero `transferType="team"`, erro-duro em time inexistente/ambíguo. +34 testes, suíte 575 verde.

**Diagnóstico (achado do código):** `transferType` está em `ACTION_FIELDS` ([flowTools.ts:33](src/tools/flowTools.ts#L33))
e o `set_action_field` grava **texto livre, sem validar o enum** → o agente chutou `"team"`. O enum real
(6 valores) e o mapa categoria→tipo vivem **duplicados** (`nodeCatalog` [nodeCatalog.ts:93](src/utils/nodeCatalog.ts#L93)
× `DetailPanel` `TRANSFER_MAP`/`TRANSFER_SUBS` [DetailPanel.tsx:125-144](src/components/DetailPanel.tsx#L125-L144)) —
a duplicação sem fonte única é o que deixou o enum solto. O nó exige **dois campos acoplados**:
`transferType` (enum de 6) + `value` (objectId resolvido, ou variável nos tipos `search`).

**Decisões (com o porquê):**
1. **Tool dedicada `set_transfer` (Q5), na filosofia do `set_menu`/`set_category`.** Campo estruturado
   (enum fechado + valor que exige resolver) = tool semântica, não `set_action_field` cru. É como
   category/keywords/context já são tratados. **Guidance-só foi recusado** — a orquestração (resolver
   time, usar objectId, escolher o tipo) é exatamente o que o agente já botou a perder.
2. **Cobertura COMPLETA dos 6 tipos, espelhando a UI (Q6):**
   `set_transfer(node, category, sub?, target?)` — `category: userPrevious | branch | user | group`;
   `sub` (exigido só p/ user/group): `user → name|email`, `group → simple|advanced`; `target`: nos tipos
   **direct** = nome→resolve p/ objectId (`find_team`/`find_user`), nos **search** = a variável verbatim,
   em userPrevious/branch = omitido. Mapeia p/ os 6 `transferType`.
3. **Fonte única dos mapas de transferência (Q6).** Extrair `TRANSFER_MAP`/`TRANSFER_SUBS`/categorias p/
   um módulo compartilhado (ex.: `src/utils/transfer.ts`), importado por `DetailPanel`, `set_transfer`,
   `nodeCatalog` e `validate()`. Mata a 3ª cópia — a duplicação foi a raiz do enum solto (CLAUDE.md: não duplicar).
4. **Remover `transferType` de `ACTION_FIELDS` (Q7).** `set_transfer` vira o **único** caminho → `"team"`
   impossível por construção. Espelha category/keywords/context (não estão no `set_action_field`).
   `set_action_field` responde **erro-guia** ("use set_transfer") se `transferType` for tentado. `value`
   fica em `ACTION_FIELDS` (genérico); quem escreve `value` do transfer é o `set_transfer`.
5. **Resolução INTERNA na tool (Q5).** `set_transfer` chama `find_team`/`find_user` internamente
   (name→objectId) — "resolver por nome → gravar por ID", o ID sempre vem de resposta real da API.
6. **Caminho infeliz = ERRO DURO (Q8).** Não-encontrado / ambíguo (2 times mesmo nome) / sem-token →
   **falha sem gravar nada** (nunca inventar ID, nunca nó meia-boca). O agente recebe o erro e resolve
   (garante o time / pergunta ao humano). O `validate()` ainda **nudga** transfer sem `transferType` ou
   sem `value` quando o tipo exige (padrão "opção sem conexão" da v0.19.0).

**Como será testado (Fase B):**
- **Unit** ([flowTools.test.ts](src/tools/flowTools.test.ts), com `find_team`/`find_user` mockados):
  `set_transfer('group','simple', 'Consultores')` → `transferType=direct4group` + `value=<objectId>` ·
  `userPrevious`/`branch` → tipo certo, value vazio · `search` → grava variável verbatim (sem resolver) ·
  time não-encontrado → **erro** (nada gravado) · nome ambíguo → **erro listando matches** · sem token →
  **erro** · nó não-transfer → **erro**. `set_action_field('transferType', …)` → **erro-guia** apontando `set_transfer`.
  Nudge do `validate()`: transfer sem tipo/sem value exigido → **dispara**; completo → **não**; não-bloqueante.
- **`mcp:typecheck`** limpo (registro da tool + zod; enum da fonte única).
- **`/verify` e2e (fixture Fluent School):** rodar o prompt com os times reais existindo na loja de teste;
  assert que os 3 transfers ("Consultores"/"Financeiro"/"Suporte ao Aluno") ficaram `direct4group` com
  `value` = objectId real, **zero** `transferType="team"`.

**Riscos/pendências (ambas as fases):**
- Hard-block no `buildButtonList` muda o comportamento da UI (hoje salva em silêncio) — o `maxLength`
  mitiga, mas revisar os testes de componente do menu que porventura gravem valores longos.
- Remover `transferType` de `ACTION_FIELDS` toca testes existentes do `set_action_field` — atualizar.
- Extração dos mapas de transferência toca o `DetailPanel` (~3500 linhas) — arquivo mais arriscado;
  fatiar a extração sem mudar comportamento (só mover + importar), com a suíte verde como gate.
- Erro-duro no `set_transfer` (Q8) trava a construção se o time não existir na loja — aceito por decisão;
  o fluxo Fluent School assume os times já criados no ambiente de teste.

### Redesign do widget do agente: botão-menu + expansão animada + janela redimensionável ✅ IMPLEMENTADA e mergeada (v0.36.0, PR #12)

> **Resultado (2026-07-06):** feature completa (decisões 1–7). As decisões 1/2/5 (âncora topo-direito
> + expansão animada por máquina de estados) e 3/4 (botão-menu + ondas sonoras, commit `3113e71`)
> já estavam; esta sessão fechou a **decisão 6** (resize) + 7 (nada persiste). Novo hook
> [useResizable.ts](src/hooks/useResizable.ts) (alça inferior-esquerda, canto sup-direito fixo, clamp
> [mín=default, viewport]) + `clampResize` puro; [useDraggable.ts](src/hooks/useDraggable.ts) expõe
> `pos`/`setPos` p/ recuar o `left` no modo arrastado. **+6 testes** ([useResizable.test.ts](src/hooks/useResizable.test.ts)),
> suíte cheia **581 verde**, `tsc` limpo. `/verify` (Playwright, `npm run dev`) confirmou os dois modos:
> ancorado-por-CSS e arrastado-inline mantêm o canto superior-direito fixo, crescendo p/ esquerda+baixo
> e clampando na viewport. Versão a atribuir no merge (CHANGELOG em [Não lançado]).
>
> Plano fechado por interrogatório (skill `interrogar`) em 2026-07-06. Decisões TRAVADAS abaixo —
> registro do raciocínio; não reabrir sem novo interrogatório. Escopo: só o widget flutuante
> [ChatPanel.tsx](src/components/ChatPanel.tsx) (dev-only, `import.meta.env.DEV`) + [useDraggable.ts](src/hooks/useDraggable.ts).

**Objetivo (1 frase):** o botão minimizado do agente ganha a **cara da ferramenta** (retangular
arredondado, cor do menu, ícone animado no lugar do ponto de status), abre com **expansão animada
da direita p/ esquerda** e a janela passa a ser **redimensionável** (mín = tamanho atual, cresce livre).

**Estado atual (achado do código):** o `ChatPanel` é um wrapper único (`fixed z-30`) com ternário
`!open ? pill : painel`. A pill é `rounded-full bg-zinc-800` (não segue o tema), ancorada
`bottom-4 right-4`, arrastável via `useDraggable` (posição só em memória, sem localStorage). A
abertura é **troca instantânea** (sem transição). O "círculo verde" é na verdade o `STATUS_DOT` de
**conexão WebSocket** (verde=open · âmbar=connecting · vermelho=closed), renderizado na pill (`h-2 w-2`)
e no header (`h-2.5 w-2.5`); quando bloqueado pelo gate, um cadeado substitui o ponto. Janela **fixa**
`w-[400px] max-w-[92vw] h-[600px] max-h-[80vh]`, sem resize. Rail/menu = `bg-zinc-950` (sempre escuro,
independe do tema — [Sidebar.tsx:77](src/components/Sidebar.tsx#L77)); painel aberto segue o tema (slate).

**Decisões (com o porquê):**
1. **Arraste MANTIDO, mas inicia no topo-direito (Q1).** Troca a âncora default `bottom-4 right-4` →
   `top-4 right-4` (painel passa a crescer p/ baixo). O `useDraggable` continua; posição segue **só em
   memória** (decisão registrada intacta). *Por quê manter:* o usuário quis preservar o reposicionamento.
2. **Expansão SEMPRE p/ esquerda + clamp (Q2).** `transform-origin: top right`; a janela cresce p/
   esquerda e p/ baixo. Se o botão foi arrastado p/ perto da borda esquerda e não couber, faz **clamp**
   de volta p/ dentro da viewport ao fim da animação. *Por quê:* direção fixa é previsível; clamp cobre o
   caminho-infeliz sem lógica condicional de direção.
3. **Formato `rounded-2xl` + cor `bg-zinc-950` SEMPRE escura (Q3).** A pill vira retângulo arredondado
   igual ao painel/sidebar (`rounded-2xl`), cor do menu (`zinc-950`, hover `zinc-800`), independente do
   tema — como o rail. Mantém o acento `border-amber-400` quando `running`. O **painel aberto NÃO muda**
   (segue theme-aware slate) — o pedido de cor foi só sobre o minimizado. Mantém texto "Agente" + ícone de balão.
4. **Ícone único sempre visível, cor = estado de conexão (Q4).** Remove o ponto; entra um **ícone de ondas
   sonoras** (3 barrinhas verticais, keyframes CSS de `scaleY` em loop) no lugar. A **cor** reflete o estado
   (verde/âmbar/vermelho, reusando o mapa `STATUS_DOT`); quando `running`, anima **mais rápido**; parado,
   "respira" devagar. *Por quê não substituir tudo:* preserva o diagnóstico de conexão (útil no dev — chat
   depende de `npm run ws:dev`). Quando **bloqueado** pelo gate, mantém o **cadeado** (ondas só quando desbloqueado).
5. **Animação = transição de `width`+`height`, não scale (Q5).** Máquina de estados `closed → opening →
   open → closing`. O container transiciona largura/altura entre o footprint da pill e o tamanho do painel
   em **~320ms `ease-out`**, `overflow-hidden`, conteúdo em **cross-fade**. *Por quê width/height e não
   `transform: scale`:* scale distorce/espreme o texto; o usuário pediu que "expanda de verdade", não um
   pop. Respeitar **`prefers-reduced-motion`** (encurtar/desligar a expansão e as ondas).
6. **Resize: alça no canto INFERIOR-ESQUERDO, mín 400×600, máx = viewport (Q6).** Ancorado no topo-direito,
   arrastar a alça p/ esquerda/baixo aumenta (canto superior-direito fica fixo). Mín = tamanho atual
   (400×600); cresce livre até as bordas da viewport (clamp). Tamanho **só em memória** — nada persiste (Q7).
7. **Nada persiste (Q7).** Tamanho e posição vivem só na sessão; recarregar volta ao default (topo-direito,
   400×600). *Por quê (após o usuário levantar "produto real"):* o caminho-produto (Fase 5) guardará
   preferências no **servidor/conta**, não no browser; localStorage agora seria stopgap descartável. Mantém
   a decisão registrada "sem localStorage" e o requisito "inicia no topo-direito" sem conflito.

**Riscos/caminho-infeliz:**
- **Interação drag × resize (principal risco de impl):** o `useDraggable` posiciona por `top/left` quando
  arrastado, mas o resize exige **âncora fixa no canto superior-direito** (aumentar largura ⇒ diminuir `left`).
  A matemática do resize precisa manter esse canto fixo tanto no modo ancorado-por-CSS quanto no arrastado-inline.
  Fatiar num hook próprio (`useResizable`) ou estender o `useDraggable`, sem quebrar o clamp já existente.
- **Clamp na expansão:** se arrastado p/ a esquerda, medir se 400px cabem; senão empurrar p/ dentro no fim.
- **Estados de gate durante animação:** abrir enquanto `blocked` não deve iniciar a expansão (hoje abre o
  popover); a máquina de estados só entra em `opening` quando desbloqueado.

**Como será testado:**
- **Manual/visual no `npm run dev`** (widget é dev-only e a feature é majoritariamente animação/interação):
  botão com cara de menu; expansão devagar da direita p/ esquerda; ondas mudando de cor por estado (derrubar
  o `ws:dev` → vermelho; subir → verde); resize a partir do canto inf-esquerdo respeitando mín 400×600 e a
  borda da viewport; arrastar p/ borda esquerda e abrir → clamp; recarregar → volta ao topo-direito 400×600.
- **Unit (lógica pura):** função de **clamp de tamanho** (mín/máx/viewport) e o mapa cor-por-estado das ondas.
- **`prefers-reduced-motion`** com a flag ligada no DevTools → sem animação de expansão nem de ondas.

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
