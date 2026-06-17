# Changelog

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

> **Regra de bumping:**
> - `PATCH` (0.x.**y**) — correções de bug sem mudança de interface
> - `MINOR` (0.**x**.0) — funcionalidades novas retrocompatíveis
> - `MAJOR` (**x**.0.0) — quebra de compatibilidade (estrutura do JSON de entrada, etc.)

---

## [Não lançado]

### Adicionado
- **Variável "Times" — Fase 1 (schema estático) + sonda da fonte de dados** — preparação para o picker de Time espelhar o do Bot (`Time → times da loja → Nome / Aberto Agora / Horário de Abertura/Fechamento → dias → componentes`), já que o token de Time só difere do Bot por um segmento de **ID** no caminho (`@team.{id}.campo[.dia]#comp`, ver `example`):
  - **Schema de campos unificado** ([src/utils/variables.ts](src/utils/variables.ts)) — `botDayItems()` virou os geradores reaproveitáveis `dayItems(base)` e `entityFieldItems(base)`, parametrizados pelo prefixo (`@bot` ou `@team.{id}`); o grupo **Bot** passou a usar `entityFieldItems('@bot')` (saída idêntica, sem regressão).
  - **`variableDisplay` resolve tokens de Time** — `@team.{id}.campo[.dia]#comp` agora exibe o rótulo amigável **"Time.{id}.…"** (ex.: `@team.fdI9crpRsB.name#normalizeQuery` → "Time.fdI9crpRsB.Nome.Texto normalizado"), reusando o schema do Bot; o `@team` pelado segue como prefixo livre. _Fase 1: o ID do time aparece cru; a substituição por **nome do time** virá na Fase 2, quando a lista vier da API._
  - **Sonda read-only** ([scripts/probe-teams.mjs](scripts/probe-teams.mjs)) — descobre, **só com o token de sessão** (master key REST nunca toca o frontend), se há um caminho de times **browser-safe** (CORS + auth de sessão). **Resultado (bot de testes):** a Team-class no Parse (`api-private2`) responde **CORS 204 + GET 200 com os times** usando só o **token de sessão** — **a master key da curl original era desnecessária**. `/v2/bots` é browser-safe e traz `retailerId`; endpoints de times no execute-api dão 403 (não existem).
  - **Módulo de dados dos times** ([src/utils/teams.ts](src/utils/teams.ts)) — núcleo testável (sem React, `fetch` injetável como o `pushFlow.ts`): `fetchRetailerId({botId})` (casa o bot em `/v2/bots`), `fetchTeams({retailerId})` (lê a Team-class por sessão, devolve `{objectId, name}` ordenado por nome) e `fetchStoreTeams({botId})` (compõe os dois). Token só nos headers, nunca logado.
  - **Token de sessão GLOBAL** ([src/App.tsx](src/App.tsx), [src/components/TopBar.tsx](src/components/TopBar.tsx)) — antes cada diálogo (push/restore) pedia o token isolado; agora há um **campo único na barra** (botão de chave com popover, só em memória, nunca salvo/logado) reaproveitado por **Enviar**, **Restaurar** e pelo carregamento dos **times**. `PushDialog`/`RestoreDialog` passaram a receber `token`/`onTokenChange` (estado elevado ao App), preservando seus guardrails.
  - **Coluna de times no picker** ([src/contexts/TeamsContext.tsx](src/contexts/TeamsContext.tsx), [src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)) — a categoria **Time** abriu uma 2ª coluna **dinâmica** com os times da loja, carregados **automaticamente** ao abrir a categoria quando há token (estados de carregando/erro/vazio) via `TeamsContext` (evita threadar props por 4 níveis). Sem token, mostra o aviso clicável **"Insira o token da sessão"** que abre o campo de token na barra (que **fecha sozinho ao colar** o token). Escolher um time abre o **mesmo schema de campos do Bot** (`entityFieldItems`) e grava `@team.{id}.campo[.dia]#comp`. O `variableDisplay` recebe o mapa id→nome e exibe **"Time.{nome}.…"** (nome do time em vez do ID) no campo de variável única. Mensagens de erro do fetch incluem o motivo do servidor (ex.: `209 Invalid session token`) sem expor o token.
  - **Testes:** casos novos em `variables.test.ts` (os 4 campos da amostra, forma crua, `@team` pelado, campo inexistente, troca id→nome) + `teams.test.ts` (retailer/times, caminhos infelizes: bot ausente, status ≠ 2xx, time sem `name`/sem `objectId`, composição). **243 testes** Vitest + tsc + build verdes; smoke real `scripts/smoke-phase9-teams.mjs` valida o fluxo ponta a ponta contra a API (token global → carregar times → escolher time → `@team.{id}.isOpenNow`).
- **Painel de edição alinhado ao construtor da plataforma** — o painel de detalhes passou a espelhar o comportamento real do builder da OmniChat ao editar a meta da intenção e o gatilho da condição:
  - **Campos por tipo de condição** (componente compartilhado `ConditionTypeFields`, usado tanto no editor de condição individual quanto na lista de condições do modo grupo/solo — antes a lógica só existia no editor individual, então **nó solo nunca via** esses campos):
    - **"O contexto é igual a"** (`context`) → dois seletores de **intenções existentes**: **Intenção** (`condition.intent`) e **Contexto** (`condition.context`).
    - **"A última intenção foi"** (`lastIntent`) → um seletor **Intenção** (`condition.intent`).
    - **"O valor está vazio"** (`empty`) → campo **Variável** com o picker de `@` (abaixo).
  - **Picker de variáveis em até 3 níveis** ([src/utils/variables.ts](src/utils/variables.ts) + `VariablePicker`) — ao clicar/digitar `@`, abre **Categoria** (Consumidor, Canal, Bot, Lista, Loja, API, Personalizado, Pedido, Chat, Time, Flow) → **Variável** (rótulos legíveis: "Nome", "CPF", "CEP"…) → **Modificador** (só quando há escolha real: `customer.birthDate`, `store.number` e os 14 horários do bot). O front **exibe o rótulo amigável** ("Loja › Número (Só dígitos)") mas **grava a variável crua** no objeto (`@store.number#onlyNumbers`). Catálogo curado/estático (a plataforma não expõe por API); horários do bot gerados (2 campos × 7 dias). Campo personalizado (`@customer.customFields.{id}`) e namespaces livres (`@api`, `@custom`…) inserem prefixo e liberam digitação.
  - **Categoria como combobox** (`CategorySelect`) — valor padrão **"Sem Categoria"**, dropdown com as categorias **já existentes no fluxo** e digitar cria uma nova. As categorias são guardadas num **store de sessão acumulativo** (`knownCategories` no App, alimentado na **importação** via `collectCategories` e a cada edição salva) — espelha a plataforma, onde cada save grava a categoria e ela fica disponível nas demais intenções (aqui só fazemos push no fim, então guardamos localmente).
  - **Palavras-chave como tags** (`KeywordTags`) — o campo (renomeado de "Keywords") virou input de chips: digita + Enter cria a tag, "×" remove; mantém internamente a string separada por vírgula (compatível com o submit).
  - **"Valor contém" com o mesmo esquema de TAGs das palavras-chave** ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx), [src/utils/editIntent.ts](src/utils/editIntent.ts)) — no gatilho `contains`, o antigo campo de texto único "Valor" virou o campo **"Valores"** com chips reutilizando o `KeywordTags`. A lista é a **fonte de verdade da plataforma**: gravada no array `condition.values` (confirmado em amostras reais, ex.: `samples/sample03.json`), com `condition.value` mantido como placeholder `"any"`. `buildDraft` lê de `values` (helper `condValueForDraft`) e `updateCondition` roteia a lista para `values` quando o tipo é `contains`, **limpando `values`** ao trocar o gatilho para outro tipo (evita lista órfã). Tipo `Condition.values` saiu de `unknown` para `string[] | null`.
  - **Campo "Variável" com o picker de `@` em mais gatilhos** ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)) — `equals` ("Valor é igual a"), `contains` ("O valor contém"), `totalIsGreaterThan` ("Total é maior que") e `totalIsEqual` ("Total é igual a") passaram a usar o `VariablePicker` (busca/seleção de variável, igual a `empty`/`exists`) no lugar do antigo input de texto livre.
  - **"Total é maior que" / "Total é igual a" com campo numérico (stepper)** ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx), [src/utils/editIntent.ts](src/utils/editIntent.ts)) — novo componente `NumberStepper` (botões −/+, **começando em 0**, aceita inteiros **negativos**). O número é a **fonte de verdade da plataforma**: gravado como **string** em `condition.valueNumber` (confirmado nas amostras, ex.: `valueNumber: "1"`), com `condition.value` mantido como placeholder `"any"`. `updateCondition` limpa `valueNumber` ao trocar o gatilho para outro tipo (sem número órfão). Tipo `Condition.valueNumber` saiu de `unknown` para `string | null`.
  - **Validação do nome da intenção (`mixed_snake_case`)** — o campo bloqueia caracteres inválidos **em tempo real** (espelhando a diretiva `specialcharacter` do builder): espaço vira `_`, acentos/símbolos são removidos; `updateIntentMeta` valida `[A-Za-z0-9_]` como rede de segurança no submit.
  - **Testes:** novo `src/utils/variables.test.ts` (catálogo, modificadores, `variableDisplay`) + casos em `editIntent.test.ts` (`sanitizeIntentName`, `collectCategories`, `updateCondition` gravando `intent`/`context`, o tipo `contains` gravando `values` e os tipos `total*` gravando `valueNumber`). **251 testes** Vitest + tsc verdes.
- **Fase 7 — Duplicação de nós (3 formas)** — recriar uma intenção/condição parecida não exige mais refazê-la à mão. Decisão de desenho (Andy, 2026-06-16): a cópia é **fiel** — preserva as conexões de saída (`next.intent`, `action.choices`, `error.next`, `context`, `fallbackIntents`), de modo que o que apontava para fora continua apontando; só os **IDs de botões são regerados** (UUID novo) para não colidir com os do original; nada aponta PARA a cópia (entrada vazia, esperado numa duplicata). O nó de **início nunca é duplicado**.
  - **Ctrl + arrastar** um nó-intenção (nó solto ou container de grupo) **duplica a intenção inteira** (todas as condições) no ponto do drop, mantendo o original no lugar. Filhos-condição (travados em `extent:'parent'`) não entram no gesto — para eles, os botões do painel. Exigiu `multiSelectionKeyCode={null}` no `<ReactFlow>` (o Ctrl/Cmd era usado para multisseleção e conflitava com o gesto).
  - **Botão "Duplicar Condição"** no painel (modos condição e solto) — copia **uma condição dentro da MESMA intenção**; num nó solto, isso o transforma em **grupo** (2 condições).
  - **Botão "Duplicar Intenção"** (numa condição-filha) extrai aquela condição para uma **intenção nova** (meta herdada da origem); o mesmo rótulo no grupo/solto copia a intenção inteira numa nova. _Os dois botões de duplicação ficam lado a lado quando ambos se aplicam._
  - **Núcleo isolado e testável** em [src/utils/duplicate.ts](src/utils/duplicate.ts) (`regenButtonIds`, `cloneCondition`, `makeUniqueName`, `duplicateConditionInIntent`, `cloneIntent`, `intentFromCondition`) — nomes de cópia ficam únicos (`_copia`, `_copia_2`…) já que `validateFlow` só barra **ID** duplicado, não nome. Os handlers no `App.tsx` seguem o padrão existente (`takeSnap → muta modelo → parseFlow → merge de posições → bumpModel`), então a duplicação entra no histórico de **undo/redo**.
  - **Feedback visual (esmeralda "marching ants"):** durante o **Ctrl+arrastar**, a cópia nasce **já no início do gesto** (anexada sem re-parsear, para não cancelar o arraste do original) e tanto o original quanto a cópia ganham **borda tracejada animada** + **arestas tracejadas/animadas** em esmeralda; **ao soltar**, ambos voltam ao normal. Na duplicação **pelos botões**, a cópia nasce **já destacada** e perde o destaque na 1ª vez que for **clicada ou arrastada**. O destaque é estado transitório de UI (`highlightIds` no App, aplicado por `displayNodes`/`displayEdges` derivados) — nunca entra no modelo/JSON nem no histórico; as arestas reusam o `animated` do React Flow (CSS novo só para o nó: `.fluxo-dup` + `@keyframes fluxo-marching` em [src/index.css](src/index.css)).
  - **Testes:** novo `src/utils/duplicate.test.ts` (10 casos, incl. caminhos infelizes: `condIdx` fora do range) + smokes `scripts/smoke-phase7-duplicate.mjs` (as 3 formas + IDs de botão sem colisão) e `scripts/smoke-phase7-dup-highlight.mjs` (destaque da cópia por botão, limpeza ao clicar, Ctrl+arrastar sem destaque remanescente). Build (tsc) e **209 testes** Vitest verdes; smokes de regressão (Marcos C/D, fase 5, remover conexão) passam.
- **Guia de uso atualizado para a v0.14.0 (Fase 6 / Modelo B)** ([docs/GUIA-DE-USO.md](docs/GUIA-DE-USO.md)) — cabeçalho saiu de "v0.12.1 + push CLI" para v0.14.0; nova seção introdutória **explicando o Modelo B** (um nó por condição, nó solto vs. grupo, e os 3 tipos de aresta: fluxo/contexto/outro bot); criação de nós atualizada para os **11 tipos em 2 grupos** (Fluxo/Avançado) + o **merge por drag** (soltar sobre um nó vira condição); edição de conteúdo reescrita para os **3 modos do painel** (grupo/condição/solo) com prioridade e contexto; remoção de aresta pela **tag "×"**; nó de início **somente-leitura**; nova seção de **envio pela UI** (diálogo de push com guardrails) e **Restaurar backup**, com a CLI mantida como caminho alternativo; links cruzados para README, doc de testes e modelo de intenção
- **Documentação dos testes automatizados** ([docs/TESTES-AUTOMATIZADOS.md](docs/TESTES-AUTOMATIZADOS.md)) — lista os **199 testes unitários** (Vitest, 9 arquivos) e os **13 scripts de smoke** (Playwright), cada um com uma breve explicação do que cobre, agrupados por arquivo/describe e por fase/marco. Inclui como rodar (suíte, arquivo único, caso único, smokes), uma tabela-resumo por arquivo e a filosofia de cobertura (caminho feliz + infeliz + invariantes de segurança). Linkado a partir do README

### Adicionado (picker de variáveis — iteração)
- **Duplo clique no picker de variáveis seleciona o nível atual** ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)) — o clique simples continua navegando (expande a próxima coluna nos nós-ramo), mas o **duplo clique grava o valor cru daquele nível**, pulando as etapas seguintes: categoria → `@${namespace}` (ex.: "Consumidor" → `@customer`); item → sua base (ex.: "Nome" → `@customer.name`, sem componente); subitem (dia) → `@bot.openingTime.monday`. Itens-ramo sem valor próprio (ex.: "Horário de Abertura") seguem só expandindo, pois não há variável crua correspondente na lista da OmniChat.
- **Coluna "Componentes (#)" no final do picker de variáveis** ([src/utils/variables.ts](src/utils/variables.ts), [src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)) — os formatadores `#` (antes embutidos no valor, ex.: `@customer.name#normalizeQuery`) viraram uma coluna final selecionável, exibida **só para as variáveis que aceitam algum componente**. Mapeamento (fonte: lista da OmniChat): `#normalizeQuery` (nome, sobrenome, bot.nome, endereços/cidade/estado/identificador da loja, número da loja, URL de checkout), `#onlyNumbers` (e-mail, CPF, CNPJ, número da loja), `#formatIsoDate` (data de nascimento), `#zipcode` (CEP), `#currency` (total/subtotal/frete/desconto do pedido) e `#getHourOfDate`/`#getHoursAndMinutesOfDate` (todos os 7 dias de abertura/fechamento). Novo tipo `VariableComponent` e campo `components` em `VariableItem` (o `value` agora é a base crua sem `#`). `variableDisplay` resolve tanto `value + #componente` ("Pedido.Total.Moeda") quanto a forma crua sem componente ("Consumidor.Nome"), preservando a exibição de fluxos antigos.
- **Comando `@` agora funciona nos campos de mensagem** — os textareas de mensagem (TEXT existente, TEXT nova e corpo da mensagem de botões) ganharam autocomplete de variáveis: digitar `@` abre o `VariableMenu` e a escolha **insere o token cru** (`@customer.name`) na posição do cursor, permitindo misturar texto livre com várias variáveis ("Olá @customer.name 👋"). O conteúdo é gravado/enviado verbatim, como a OmniChat espera (confirmado em `example.json`, onde `content` guarda tokens crus). Novo componente reutilizável `VariableTextArea` ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)).

### Alterado
- **Rótulos de variáveis renomeados** ([src/utils/variables.ts](src/utils/variables.ts)) — só exibição; os valores crus permanecem: "ID do canal" → **Telefone** (`@channel.id`), "Tipo do canal" → **Tipo** (`@channel.type`), "Palavras-chave atuais" → **Palavra-chave** (`@chat.currentKeyWords`).
- **Expansão das colunas do picker por clique (a partir da 2ª coluna)** ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)) — antes a navegação entre colunas era por hover (`onMouseEnter`), o que abria/trocava colunas profundas sem querer. Agora a 1ª coluna (categorias) mantém o hover como preview, mas **da 2ª coluna em diante a próxima só abre ao clicar** num item.
- **Variáveis exibidas no padrão separado por ponto** ([src/utils/variables.ts](src/utils/variables.ts)) — `variableDisplay` trocou o separador breadcrumb (`Consumidor › Nome`) por **ponto** (`Consumidor.Nome`, `Loja.Número.Só dígitos`, `Bot.Horário de Abertura.segunda.Apenas Horário`); o modificador (quando há) virou mais um segmento dotado.
- **Campo de variável da condição virou editável como texto** — antes, ao escolher uma variável o campo ficava `readOnly` exibindo o rótulo amigável. Agora exibe o rótulo dotado quando o valor bate com o catálogo, mas **ao focar revela o token cru e fica editável** (ajuste fino à mão, ex.: um modificador fora do catálogo). Clicar/`@` continua abrindo o picker.
- **Picker de variáveis refatorado em peça reutilizável** — o dropdown de 4 níveis (Categoria → Item → subitem → Modificador) foi extraído para o componente `VariableMenu`, ancorado a qualquer campo (input ou textarea) via portal `fixed`. Compartilhado entre `VariablePicker` (campo de condição, escolha **substitui** o valor) e `VariableTextArea` (mensagens, escolha **insere** no cursor).
- **Grupo "Bot" do picker de variáveis reorganizado em 4 opções com hierarquia de horários** ([src/utils/variables.ts](src/utils/variables.ts)) — antes o grupo era plano: "Está aberto agora", "Nome do bot" e 14 itens soltos (`Abertura segunda`…`Fechamento domingo`). Agora são **4 opções**: **Aberto Agora** (`@bot.isOpenNow`), **Nome** (`@bot.name#normalizeQuery`), **Horário de Abertura** e **Horário de Fechamento**. Os dois horários viraram **itens-ramo**: abrem uma coluna com os **7 dias da semana**, e cada dia abre os **2 modificadores** (renomeados para **"Apenas Horário"** = `#getHourOfDate` e **"Apenas Horário com Minutos"** = `#getHoursAndMinutesOfDate`). O valor cru gravado é o mesmo de antes (`@bot.openingTime.monday#getHourOfDate`); só a navegação e os rótulos mudaram.
  - **Modelo de dados:** `VariableItem` ganhou `children?: VariableItem[]` (item-ramo, sem `value`) e `value` virou opcional. `variableDisplay` agora resolve recursivamente, exibindo o caminho completo ("Bot › Horário de Abertura › segunda (Apenas Horário)").
  - **Picker (4 níveis):** `VariablePicker` ganhou um estado `activeChild` e uma 4ª coluna; colunas passaram a ter **largura fixa** (`w-48`, sem encolher, `whitespace-nowrap`) em vez de `flex-1`, comportando o rótulo mais longo sem quebra e crescendo para a esquerda sobre o canvas.
  - **Testes:** `variables.test.ts` atualizado (estrutura das 4 opções, ramo com 7 dias × 2 modificadores, `variableDisplay` aninhado). **229 testes** Vitest + tsc verdes.

### Corrigido
- **"Sem condição" e "Senão" não mostram mais campos de preenchimento** ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx)) — os tipos `any` ("Sem condição") e `else` ("Senão") não têm operando, mas caíam no caso padrão do `ConditionTypeFields` e exibiam **Variável + Valor** indevidamente; agora não renderizam campo algum. De quebra, `exists` ("Valor existe") passou a exibir só **Variável** (como `empty`), já que opera sobre uma variável sem valor de comparação. Vale para os dois editores (condição individual e lista no modo grupo/solo), que compartilham o componente.
- **Picker de variáveis não é mais cortado pelo painel de edição** — o dropdown do `VariablePicker` (que abre ao clicar/digitar `@`) usava `position: absolute` dentro do corpo do `DetailPanel`, que é `overflow-y-auto` e tem largura fixa (`w-96`); como o painel do picker é mais largo (`min-w-[26rem]`), ele era recortado tanto na largura quanto ao rolar a lista de campos. Agora o dropdown é renderizado via **portal** (`react-dom`) em `document.body` com `position: fixed`, ancorado ao `getBoundingClientRect()` do input (alinhado à direita do campo, logo abaixo) — assim **sobrepõe o canvas** sem ser cortado. A posição é recalculada em `resize` e em `scroll` (com `capture` para acompanhar o scroll interno do painel), e o fechamento por clique-fora passou a checar também o `panelRef` do portal (que vive fora do `wrapRef`). ([src/components/DetailPanel.tsx](src/components/DetailPanel.tsx))

### Alterado
- **README atualizado para o estado atual (Fase 6 / Modelo B)** — `Funcionalidades` reorganizada por tema (Visualização, Edição, Entrada/saída, Sincronização) refletindo Modelo B, undo/redo, tags de aresta e os 11 tipos da paleta; `Stack` ganhou Vitest e Playwright; `Estrutura do projeto` reescrita conforme os arquivos reais (removidas refs a `JsonInput`/`ExportControls`, adicionados `nodeMeta`, `editFlow`, `pushFlow`, `restoreFlow`, diálogos e os 5 nós novos); `Tipos de nó` expandida para os 13 nós + container de grupo, com as cores corretas dos tipos da Fase 6 (Pedido laranja, CSAT rosa, Loja verde-limão); diagrama de fluxo de dados atualizado para `actionToNodeKind`/grupos/serialize/export/push

## [0.14.0] - 2026-06-15

### Adicionado
- **Remover conexões pela tag da aresta** — toda aresta de fluxo interna (`-next` e de escolha) ganhou no meio uma **tag** (pill estilizado) que reúne o **rótulo da conexão + um botão "×"** num único elemento, **elevado acima das linhas** (zIndex + fundo opaco que cobre o traço) — antes a linha ficava por cima e dificultava o clique. Forma descobrível de desfazer a ligação, além do atalho Delete (que segue valendo). Implementado como aresta customizada `DeletableEdge` ([src/components/edges/DeletableEdge.tsx](src/components/edges/DeletableEdge.tsx)) registrada em `edgeTypes`, com a tag acompanhando o tema (claro/escuro via `EdgeActionsContext`); o clique no "×" cai no **mesmo caminho** da exclusão por teclado (`handleEdgesChange` → `applyEdgeDelete` + histórico/undo). Arestas para **outro bot** (`-ext`) e de **contexto** seguem sem tag (não são removíveis aqui). O `parseFlow` marca só as arestas internas com `type: 'deletable'`. _Remover uma conexão `-next` reseta o `next` para a forma canônica sem destino; remover uma de escolha esvazia o slot mantendo o botão._

- **Fase 6 — Condição tipada: escolher a ação ao adicionar condição + merge pela paleta** — duas formas (teclado/painel e mouse/canvas) de adicionar uma condição **já tipada pela ação** a uma intenção, em vez de sempre nascer como Mensagem (`action.none`):
  - **No painel:** ao clicar em **+ Adicionar condição** (modos grupo/solo do DetailPanel), a condição nova ganhou um **select "Ação"** com os 11 tipos (Mensagem, Escolha, Captura, Transferência, Espera, Definir dados, Encerrar conversa, Chamada de API, Pedido, Captura CSAT, Loja física). A condição é criada com os mesmos defaults da paleta de criação de nó (ex.: Transferência → `direct4group` + caminho de erro p/ o start; Pedido → `generateOrder`; CSAT → `supportRate`).
  - **Na paleta (merge por drag):** arrastar um tipo da paleta **sobre um nó-intenção existente** agora o adiciona como **nova condição daquela intenção** (a intenção vira um grupo com 2+ filhos) em vez de criar um nó solto. O nó-alvo é destacado com contorno tracejado durante o arraste (`merge-drop-target`). Guardas de caminho infeliz: soltar sobre o **start** (nunca agrupa), sobre um **bot externo** (sintético) ou fora de qualquer nó cai no comportamento antigo (cria nó solto); filhos de grupo são ignorados (o container cobre a área). Pós-merge o App re-parseia preservando posições (solo → grupo) e a ação entra no histórico de undo/redo.
  - **Núcleo compartilhado:** `buildKindAction(kind, botId)` centraliza os defaults por tipo (antes embutidos em `createIntentTemplate`); `createConditionForKind(kind, botId)` cria a condição canônica já tipada; `addCondition(intent, kind?)` aceita o tipo (sem ele, mantém `action.none` — retrocompatível); `CREATABLE_KIND_LABELS` virou a fonte única dos rótulos (paleta + select do painel). Novo `handleAddConditionToNode` no App e `onAddConditionToNode` no FlowCanvas (hit-test do drop via `intentNodeAt`).
  - **Testes:** +3 em `editIntent.test.ts` (`addCondition` sem kind = `none`; com kind nasce tipada com os defaults; renderiza como o nó certo no grupo) e +1 em `intentTemplates.test.ts` (`createConditionForKind` bate com a condição da intenção criada, para os 11 tipos). Novo smoke `scripts/smoke-phase6-merge.mjs` (arrasta Transferência sobre um nó solto → vira grupo com filho `::c1` transfer, sem criar intenção nova). Build (tsc + vite) e **197 testes** Vitest verdes; os 11 smokes passam.
- **Fase 6 — Marco D: criação dos 11 ActionTypes + revalidação do Modelo B** — a paleta de criação passou a oferecer **um tipo para cada um dos 11 `ActionType`** da plataforma: além dos 6 de fluxo (Mensagem, Escolha, Captura, Transferência, Espera, Definir dados), os **5 da Fase 6** — **Encerrar conversa** (`endConversation`), **Chamada de API** (`external`), **Pedido** (`order`), **Captura CSAT** (`captureCsat`) e **Loja física** (`store`). A paleta agora separa os itens em dois grupos com divisória — **Fluxo** e **Avançado** — para seguir navegável com o dobro de tipos. Um nó criado nasce como **nó solto** (1 condição), tipado pela ação; entra na estrutura de grupo do Modelo B naturalmente quando ganha uma 2ª condição pelo painel. Templates com defaults **mínimos embasados no spec** ([docs/MODELO-INTENCAO-OMNICHAT.md](docs/MODELO-INTENCAO-OMNICHAT.md) §4): `order` → `orderType: 'generateOrder'`, `captureCsat` → `captureDataType: 'supportRate'`; `endConversation`/`external`/`store` nascem sem subtipo presumido (terminal / objeto `external` canônico / enum de `storeType` desconhecido — não inventar). _Fluxos Alternativos (`fallbackIntents`), edição de `executionDelay` e publicação seguem fora de escopo._
  - **Export PNG/SVG corrigido para grupos** ([src/utils/exportImage.ts](src/utils/exportImage.ts)) — o `getNodesBounds` da `@xyflow/system`, chamado sem `nodeLookup`, lê a posição **crua** dos nós; como os nós-condição filhos de um `intentGroupNode` têm posição **relativa ao pai**, ela era tratada como absoluta e gerava um ponto fantasma perto da origem (bounds e enquadramento errados — a própria lib avisa isso para sub flows). Novo helper `boundsNodes` exclui os filhos do cálculo (o container já os cobre), restaurando o enquadramento correto. _Bug latente desde o Marco A; só aparecia ao exportar imagem de um fluxo com intenções multi-condição._
  - **Revalidação sem mudança de código:** `pushFlow`/`restoreFlow` operam sobre o **modelo** (`flow.list`/`backupData.list`, `BotIntent[]`), nunca sobre os nós do canvas — os filhos `{intentId}::c{idx}` **nunca viram intenções** no JSON e o ID cru `{intentId}` segue sendo a entrada; `validateFlow` opera sobre `json.list` e os tipos novos não introduzem referências (nó terminal `end` tem `next` sem `intent`). Confirmado por teste, não por inspeção.
  - **Testes:** +9 casos em `intentTemplates.test.ts` (os 11 tipos criáveis; cada novo kind nasce como nó solto sem grupo; defaults de `order`/`csat`; `store`/`external`/`end` sem subtipo presumido; nó terminal não bloqueia o export; criar choice → adicionar mensagem+botão → conectar preenche o slot; **serializar fluxo agrupado não vaza filhos como intenções**) + novo `exportImage.test.ts` (3 casos do `boundsNodes`: exclui filhos, fluxo plano inalterado, lista vazia). Novo smoke `scripts/smoke-phase6-create.mjs` (cria end + API pela paleta, exporta PNG de um fluxo **com grupos**, confere o JSON sem vazamento de filhos). `smoke-phase2` atualizado (paleta 6 → 11 itens). Build (tsc + vite) e **183 testes** Vitest verdes; os 10 smokes (incl. round-trip, push, restore, Marcos A/B/C) passam.
- **Fase 6 — Marco C: edição por condição (DetailPanel dois-modos)** — o painel de detalhes agora abre em **três modos** conforme o nó clicado: (1) clicar no **cabeçalho do grupo** (`intentGroupNode`) edita a **meta da intenção** — nome, categoria, keywords e, novidade, **prioridade** (select Nenhuma…Muita Alta) e **contexto** (select das outras intenções do fluxo — a origem da aresta de contexto do Marco B) — além da lista de condições (add/remover); (2) clicar num **nó-condição filho** (`{id}::c{idx}`) edita **só aquela condição**: gatilho (nome/tipo/variável/valor, com os 10 rótulos do `ConditionType`), mensagens da condição, botões/escolhas e os campos da ação (transferência/captura/setData), com botão **Excluir condição**; (3) **nó solto** (1 condição) mantém o editor completo de antes (meta + conteúdo) acrescido de prioridade/contexto. Antes do Marco C, clicar num filho abria um painel **somente-leitura**. Conectar arrastando a partir de um filho de grupo, que antes falhava (`applyConnect` buscava a intenção pelo ID com `::c`), agora preenche a vaga **daquela condição** (`{id}::c{idx}` → `condIdx` explícito). Pós-edição o App **re-parseia preservando as posições** dos nós que já existiam — robusto a mudanças estruturais (tipo do filho, nº de condições, transição grupo↔solo) sem relayout. _Fluxos Alternativos (`fallbackIntents`) e edição do `executionDelay` seguem fora de escopo._
  - **Núcleo:** `applyConnect` ([src/utils/editFlow.ts](src/utils/editFlow.ts)) ganhou origem por condição; as primitivas de [src/utils/editIntent.ts](src/utils/editIntent.ts) (`addTextMessage`, `addButton`, `removeButton`, `addButtonsMessage`, `updateButton`, `updateActionFields`, `updateSetDataItems`) aceitam `condIdx` opcional (sem ele, comportamento atual = primeira condição compatível); `updateIntentMeta` passou a aceitar `priority` e `context`.
  - **Testes:** +6 casos em `editFlow.phase3b.test.ts` (conectar por filho preenche a condição certa, recusa condição cheia/sem slot, nó solto mantém 1ª vaga) e +5 em `editIntent.test.ts` (escopo por `condIdx`, priority/context). Smoke `scripts/smoke-phase6-edit.mjs` exercita os dois modos no browser (grupo edita meta e reflete no cabeçalho; filho mostra o editor de condição; aplicar não quebra a estrutura). Build (tsc + vite) e **152 testes** Vitest verdes; os 10 smokes (incl. round-trip, push, restore, Marcos A/B) passam.
- **Fase 6 — Marco B: aresta de Contexto** — `intent.context` (a intenção que precede e "arma" outra) agora é desenhado como uma **aresta tracejada em violeta** (`contexto → esta intenção`), visualmente distinta das arestas de fluxo (cinza) e de redirect externo (âmbar/animada). Indica que a intenção de destino só ativa quando se chega vinda da intenção de contexto. A aresta sai/chega no **ID cru** da intenção (container do grupo ou nó solto), igual à entrada de fluxo; é **não editável e não deletável** nesta fase (a edição de contexto é o Marco C). Construída em `buildContextEdges` ([src/utils/parseFlow.ts](src/utils/parseFlow.ts)) com guardas de caminho infeliz: ignora `context` vazio, auto-referência, **destino inexistente** (não desenha aresta órfã) e intenção `start` (que não tem handle de entrada). Como uma intenção-de-contexto pode ser uma intenção agrupada, o `IntentGroupNode` ganhou um handle `source` usado **só** por esta aresta. As arestas de contexto **não entram no layout** (dagre) — são uma anotação cruzada, não a hierarquia principal do fluxo, então `collapseEdges` as exclui pelo marcador `data.kind === 'context'`. _Escopo do Marco B é só visualização; a edição por condição (C) e a criação/paleta (D) vêm depois._
  - **Testes:** 6 casos novos em `src/utils/parseFlow.test.ts` (aresta válida com origem/destino/estilo, origem agrupada usando o ID cru do container, auto-referência ignorada, `start` ignorado, contexto não vira aresta de fluxo no layout, contagem em sample real) + smoke `scripts/smoke-phase6-context.mjs` (fluxo sintético: confere a aresta tracejada, o contexto órfão sem aresta e a origem agrupada no browser). Build (tsc + vite) e **141 testes** Vitest verdes; os 8 smokes anteriores (incl. Marco A) seguem passando.
- **Fase 6 — Marco A: nós por condição alinhados ao modelo da plataforma (Modelo B, visualização)** — o visualizador deixa de achatar cada intenção em **um** nó (tipo único por prioridade) e passa a renderizar **um nó por condição, tipado pela ação dela**, agrupado por intenção. Uma intenção com **2+ condições** vira um `intentGroupNode` (container React Flow) com os nós-condição como **filhos** (`parentId` + `extent: 'parent'`); com **1 condição** continua um **nó solto**, sem container. Os 11 `ActionType` da plataforma agora têm nó dedicado — além dos 6 existentes, foram criados **5 novos**: `endNode` (Terminar conversa), `apiCallNode` (Chamada externa/API — **≠** `externalBotNode`, que é redirecionamento para outro bot), `orderNode` (Pedido), `csatNode` (Captura CSAT) e `storeNode` (Loja física). O cabeçalho do grupo (`IntentGroupNode`) mostra Nome · Categoria · **badge de Prioridade sempre visível** (Nenhuma…Muita Alta) · keywords em chips · ícones discretos de Contexto e tempo de resposta (`executionDelay`). Os rótulos de gatilho dos filhos usam os 10 nomes do `ConditionType` ("Valor contém", "Senão", etc.). Mapeamento e rótulos centralizados em [src/utils/nodeMeta.ts](src/utils/nodeMeta.ts). _Escopo do Marco A é **só visualização** — aresta de Contexto (B), edição por condição (C) e criação/paleta (D) vêm depois._
  - **IDs e arestas:** nó-condição filho = `{intentId}::c{idx}`; a **entrada de uma intenção** (destino das arestas) é sempre o **ID cru** `{intentId}` (container do grupo ou nó solto). A aresta sai do **handle do filho** de origem e chega na entrada do destino. Os IDs de aresta seguem `{intentId}-c{condIdx}-next|chN|ext` — o que mantém `editFlow`/`parseEdgeId` e toda a edição da Fase 1–3 funcionando sem alteração.
  - **Layout em 2 camadas** (evita dagre composto): os filhos são posicionados em linha dentro do grupo (posições relativas ao pai) e o `dagreLayout` existente roda só sobre os **nós-macro** (grupos, soltos e bots externos), com as arestas colapsadas a intent→intent só para posicionar.
  - **Testes:** `src/utils/parseFlow.test.ts` (35 casos, incl. caminhos infelizes: intenção sem condições, 0 mensagens, choice com slot vazio, `next` ausente, `context` órfão, choice para destino fora do fluxo, os 5 novos tipos isolados) + smoke `scripts/smoke-phase6.mjs` (importa `sample01-v2.json` e confere grupo + filhos + cabeçalho rico no browser). Build (tsc + vite) e **135 testes** Vitest verdes; os 7 smokes anteriores (incl. round-trip, push e restore) seguem passando sem alteração.

### Corrigido
- **Excluir uma intenção agora remove os nós-condição junto** — ao excluir uma intenção agrupada (Modelo B), o canvas removia apenas o container do grupo e deixava os **nós-filhos `{id}::c{idx}` órfãos**. O `deleteNode` ([src/App.tsx](src/App.tsx)) passou a **re-parsear o fluxo preservando posições** em vez de filtrar só o id exato: com a intenção fora do modelo, o `parseFlow` não emite o grupo nem os filhos, então as condições somem junto. (O modelo já removia as condições — eram parte do objeto da intenção; o defeito era só visual no canvas.)
- **O nó de início não é mais editável** — clicar no nó **start** abria o painel em modo completo (ele tem 1 condição → caía em `solo`), permitindo editar nome/categoria/condições da intenção canônica de início. Agora o `DetailPanel` resolve um modo **`startRO`** somente-leitura (espelhando o `externalRO`): mostra nome, condição e destino, com o aviso "O nó de início não é editável" e **sem** formulário, botão Aplicar ou Excluir. A conexão de saída do start continua editável **no canvas** (arrastar/remover a aresta) — é como o fluxo começa.
- **Smokes atualizados para a aresta com botão "×"** — `smoke-phase2` seleciona a aresta fora do meio (onde fica o "×"); `smoke-phase3`/`smoke-phase3b` leem o label da aresta no layer do `EdgeLabelRenderer` (classe `react-flow__edge-label` + `data-edge-id`). Novo `scripts/smoke-phase6-edge-delete.mjs` (remover conexão pelo "×" reflete no modelo; start abre painel read-only). Build + **199 testes** + 12 smokes verdes.

### Alterado
- **Troca de `dagre@0.8.5` por `@dagrejs/dagre@3.0.0`** — o `dagre` original está sem manutenção; o fork `@dagrejs/dagre` é o sucessor mantido pela mesma comunidade, com **API idêntica**, então a mudança se resume ao import em [src/utils/parseFlow.ts](src/utils/parseFlow.ts). O fork **embarca os próprios tipos**, permitindo remover a dependência `@types/dagre`. Build (tsc + vite) e os 100 testes Vitest seguem verdes; smoke Playwright (`smoke-phase5.mjs`) confirma o layout renderizando no browser. Bundle reduziu de ~526 kB para ~477 kB.

---

## [0.13.0] - 2026-06-15

### Adicionado
- **Restaurar backup pela UI** (`src/components/RestoreDialog.tsx` + `src/utils/restoreFlow.ts`) — botão **Restaurar** na barra superior abre um diálogo que sobe o backup `.json` e restaura o bot ao **estado real do arquivo**: exclui o excedente, **recria** o que sumiu (com remap de IDs em 2 passadas, reusando o `pushFlow`) e **sobrescreve** o resto in-place. Ordem obrigatória **deletar → recriar/atualizar** (recriar antes faria a exclusão apagar o que acabou de ser criado, pois o POST gera IDs novos). `planRestore` classifica cada intenção em excluir/recriar/sobrescrever (alimenta o dry-run); `deleteExtras` é o laço **deletar → esperar → reverificar** que tolera a consistência eventual do `DELETE` (responde 200 mas a remoção propaga em atraso); `restoreToBackup` orquestra: **snapshot de segurança** do estado atual baixado antes de destruir → exclusão → push do backup. Mesmos guardrails do push (token só em memória, confirmação do botId, trava de bot de testes, dry-run) + aviso destrutivo; só rascunho, nunca publica. `deleteIntent` adicionado ao `pushFlow.ts`. Coberto por `src/utils/restoreFlow.test.ts` (mock stateful unificado GET/POST/DELETE: restore completo com remap, prova da ordem, consistência eventual, esgotamento de rodadas, guardas de pré-flight) e pelo smoke `scripts/smoke-phase4b-restore.mjs` (upload + exclusão + recriação + safety backup, sem API real). _Motivação: o push é só upsert e nunca apaga; reimportar o backup não voltava o bot ao estado anterior — o restore preenche essa lacuna de forma fiel._
- **Fase 4b (passos 3–4): push pela UI** — botão **Enviar** na barra superior (`src/components/TopBar.tsx`, habilitado só com fluxo carregado e sem erros de validação) abre o **PushDialog** (`src/components/PushDialog.tsx`): faz o mesmo envio do CLI direto do navegador, com guardrails conscientes — token só em memória (campo password, nunca persistido/logado), confirmação do alvo digitando os últimos 6 caracteres do botId, trava "é um bot de testes", **pré-visualização (dry-run)** mostrando criações/atualizações antes de enviar, **backup do estado atual baixado** antes do primeiro POST, progresso por operação e relatório final com botão **"copiar relatório"** sanitizado. Só altera o rascunho. Helper read-only `fetchServerIntents` adicionado ao `pushFlow.ts` para o dry-run
- **Smoke test do PushDialog** (`scripts/smoke-phase4b.mjs`) — exercita o diálogo ponta a ponta **sem tocar a API real** (intercepta `window.fetch` via `addInitScript` com um servidor falso): gating do botão Enviar (token + confirmação do botId + trava de bot de testes), validação da confirmação errada, dry-run, download do backup antes do envio, relatório final e sanitização do token na UI
- **Fase 4b (passo 1): núcleo testável do push pela UI** (`src/utils/pushFlow.ts`) — porta a lógica do CLI para o browser com `fetch` injetável: `planPush` (separa criações de atualizações pela presença do ID no servidor), `remapRefs` (reaponta `next.intent`/`choices`/`error.next`/`fallbackIntents`) e `pushFlow` (orquestra as 2 passadas, sequencial com stop-on-first-error, backup via callback `onBackup` antes do primeiro POST, sem mutar o modelo do App). Token recebido por parâmetro e nunca logado nem incluído no relatório. Coberto por `src/utils/pushFlow.test.ts` (14 casos com `fetch` mockado, sem rede: planejamento, remapeamento nas 2 passadas, caminho infeliz com erro HTTP, sanitização do token e guardas de pré-flight)
- **Fase 4a: push para a plataforma via CLI** (`scripts/push-flow.mjs`) — envia o JSON exportado para o **rascunho** do bot em 2 passadas (cria → captura IDs reais do servidor → remapeia `next.intent`/`choices`/`error.next`/`fallbackIntents` → atualiza), pois a API ignora IDs novos no POST e gera outros; guardrails: dry-run sem `--yes`, `--bot` obrigatório e conferido contra o arquivo, backup automático em `samples/` e parada no primeiro erro; rollback via `scripts/rollback-bot.mjs`. Validado ponta a ponta na plataforma real ([docs/fase4-resultados.md](docs/fase4-resultados.md))
- **Guia de uso** ([docs/GUIA-DE-USO.md](docs/GUIA-DE-USO.md)) — passo a passo de todas as features atuais: importar/criar do zero, edição no canvas, painel de detalhes, undo/redo, validação, exportação, push CLI e atalhos de teclado
- **Testes de caminhos infelizes da API** (`scripts/etapa2-unhappy.mjs`) — roda os 3 testes pendentes da Etapa 2 do protocolo da Fase 4 (intent sem `conditions`, push duplicado, referência `next` quebrada) com os mesmos guardrails do push: dry-run sem `--yes`, `--bot` obrigatório, backup automático e relatório sanitizado

### Alterado
- **Referência interna quebrada agora é ERRO bloqueante** (antes era só aviso) no `validateFlow` — um `next.intent` apontando para um ID inexistente passa a impedir o export. Motivo: a API aceita a ref quebrada silenciosamente (HTTP 200), mas a tela da Omni a trata como erro a preencher e o simulador cai no Start; como o servidor não barra payloads inválidos, o Fluxo precisa barrar antes do push (pré-requisito da Fase 4b). Validado na Etapa 2 da Fase 4 ([docs/fase4-resultados.md](docs/fase4-resultados.md))

### Corrigido
- **Rollback confiável apesar da consistência eventual da API** (`scripts/rollback-bot.mjs`) — o `DELETE` da plataforma responde 200 mas a remoção é eventual (um GET logo depois ainda lista parte das intenções "deletadas"); o script virou um laço **deletar → esperar → reverificar** (até 6 rodadas) e só reporta sucesso quando o GET confirma o estado final, em vez de confiar no 200 de uma passada só. Detalhes em [docs/fase4-resultados.md](docs/fase4-resultados.md)
- **Saída limpa dos scripts de API no Windows** (`etapa2-unhappy.mjs`, `rollback-bot.mjs`) — trocado `process.exit()` por `process.exitCode` nos caminhos pós-`fetch`, que disparava uma assertion do libuv (`async.c`) ao encerrar com sockets ainda abertos

---

## [0.12.1] - 2026-06-11

### Alterado
- Controles de espaçamento (− espaço +) movidos do canvas para a barra superior, junto dos demais controles (desfazer/refazer); o painel flutuante `CanvasControls` foi removido

---

## [0.12.0] - 2026-06-11

### Adicionado
- **Fase 5c: undo/redo** — Ctrl+Z desfaz e Ctrl+Shift+Z/Ctrl+Y refaz qualquer edição (reconectar, conectar, criar/excluir nó, deletar aresta, edições do painel); botões ↶ ↷ na toolbar; histórico de até 30 passos por snapshot (`src/utils/history.ts`); atalhos ignorados com foco em campos de texto
- **Rollback de edição parcial**: se um patch do "Aplicar alterações" falhar no meio, o modelo volta ao estado pré-edição (antes ficava meio-aplicado)

## [0.11.0] - 2026-06-11

### Adicionado
- **Fase 5b: novo fluxo do zero** — botão "Novo fluxo" na toolbar pede o botId (UUID validado, copiado da URL da plataforma) e cria a intenção de início canônica (`{botId}-start`); o JSON exportado já nasce com IDs reais

## [0.10.0] - 2026-06-11

### Alterado
- **Fase 5a: redesign — de visualizador para editor**
  - Sidebar permanente de 384px removido; o canvas ocupa toda a tela sob uma toolbar fina
  - Importação virou modal (colar JSON da aba Network ou carregar arquivo), com aviso quando substitui um fluxo com edições
  - Exportação (JSON/PNG/SVG) movida do canvas para dropdown na toolbar
  - Erros e avisos viram **toasts** no rodapé do canvas (avisos somem sozinhos)
  - **Indicador de validação vivo** na toolbar: ✓ válido / ⚠ avisos / ✕ erros, recalculado a cada edição e clicável para ver a lista completa
  - Legenda de cores absorvida pela paleta (chips de Início/Outro Bot)
  - Versão exibida na toolbar agora vem do `package.json` (não dessincroniza mais)

### Removido
- Componentes `JsonInput` e `ExportControls` (substituídos por `TopBar`, `ImportDialog`, `Toast` e `CanvasControls`)

---

## [0.9.0] - 2026-06-11

### Adicionado
- **Fase 3b do editor: edição estrutural completa**
  - **Botões com sincronia posicional**: adicionar botão cria um slot vazio em `action.choices` (conecte no canvas para preenchê-lo); remover botão remove a escolha na mesma posição; "Criar mensagem de botões" monta a mensagem BUTTON canônica em nós de escolha recém-criados
  - **Conectar escolhas**: arrastar do handle de origem agora também preenche o primeiro slot de escolha vazio (a aresta nasce com o texto do botão como label)
  - **Deletar aresta de escolha**: esvazia o slot mantendo o botão (reconectável depois)
  - **Condições editáveis**: nome, tipo (qualquer/igual/existe/senão), variável e valor; adicionar e remover condições (a última é protegida)
  - **Excluir intenção** (botão no painel ou Delete no nó selecionado) com limpeza completa de referências de entrada: `next` resetado, botão+escolha removidos na mesma posição, `error.next` reapontado para o start e fallbacks filtrados; o start não é excluível

### Corrigido
- Controles de exportação movidos para o centro superior — ficavam cobertos pelo DetailPanel aberto

---

## [0.8.0] - 2026-06-11

### Adicionado
- **Fase 3a do editor: edição de conteúdo no DetailPanel**
  - O painel de detalhes virou formulário com rascunho local e botão **Aplicar alterações**: nome, categoria, keywords, mensagens (editar/adicionar/remover TEXT, editar body de BUTTON/LIST), texto/descrição dos botões, tipo+destino de transferência, tipo de captura+variável e variáveis do setData (adicionar/remover/editar)
  - Novo módulo `src/utils/editIntent.ts`: patches pequenos e validados sobre o intent cru (endereçamento estável de mensagens por `{condIdx, sayIdx, msgIdx}`), sempre atualizando `updatedAt`
  - **Validação no export** (`src/utils/validateFlow.ts`): erros bloqueiam o download (IDs duplicados, intenção sem nome/condições) e avisos informam sem bloquear (refs quebradas, fluxo sem start, botões dessincronizados das escolhas)
  - Editar texto de botão atualiza o label da aresta de escolha correspondente no canvas
- Smoke test da Fase 3 (`scripts/smoke-phase3.mjs`): edita nome/mensagem/botão, aplica e valida canvas + JSON exportado + integridade das demais intenções

### Protegido (decisões de segurança do modelo)
- Mensagens BUTTON/LIST não são removíveis pelo painel (os botões mapeiam posicionalmente para `action.choices`)
- Remoções de mensagens aplicadas em ordem decrescente de índice para não deslocar os endereços

---

## [0.7.0] - 2026-06-11

### Adicionado
- **Fase 2 do editor: criação de nós e arestas**
  - Paleta "Criar nó" no canto superior esquerdo do canvas: arraste um dos 6 tipos (Mensagem, Escolha, Captura, Transferência, Espera, Definir dados) para criar uma intenção nova na posição do drop
  - Templates canônicos de intenção (`src/utils/intentTemplates.ts`) com a forma exata que a tela oficial envia no POST — UUID v4 novo, `advanced`, defaults por tipo (transfer → `direct4group`, captureData → `free`) e caminho de erro apontando para o start
  - Conectar nós: arraste do handle inferior (origem) até outro nó — preenche `next.intent` na primeira condição livre (`redirect: continueFlow`)
  - Deletar arestas: selecione e pressione Delete/Backspace — remove a referência `next` no modelo (arestas de escolha e externas são protegidas)
  - Nós agora podem ser arrastados para reposicionar (estado visual; não afeta o JSON)
- Smoke test da Fase 2 (`scripts/smoke-phase2.mjs`): cria nó via drop, conecta, deleta aresta e valida tudo no JSON exportado

### Corrigido
- `fitView` não é mais disparado ao criar um nó (re-zoom no meio da edição desorientava e invalidava o gesto em andamento) — agora só ao gerar fluxo ou mudar espaçamento

### Alterado
- Estado dos nós elevado ao `App` (canvas totalmente controlado) — posições manuais sobrevivem à criação de novos nós
- `parseFlow` exporta `intentToNodeData` e `buildNextEdge` para reuso na criação

---

## [0.6.0] - 2026-06-11

### Adicionado
- **Fase 1 do editor (round-trip)**: o fluxo importado agora pode ser editado e exportado de volta como JSON
  - Reconexão de arestas no canvas: arraste a ponta de destino de uma conexão para outra intenção — o modelo (`next.intent` ou `action.choices`) é atualizado em memória
  - Botão **JSON** no painel de exportação: baixa o fluxo no formato `{ "list": [...] }` aceito pela plataforma, preservando integralmente os campos não editados (estratégia *preserve-and-patch*)
  - Novo módulo `src/utils/editFlow.ts`: `parseEdgeId` (decodifica IDs de aresta de volta para a posição no modelo), `applyEdgeReconnect` (patch validado com mensagens de erro) e `serializeFlow`
- Suíte de testes com Vitest (`npm test`): round-trip com os 3 samples reais, decodificação de IDs de aresta e casos de erro (aresta externa, destino inexistente, lista vazia, escolhas duplicadas)
- `PLANS.md` com o plano completo do projeto editor (fases 1–4) e o contrato de API da plataforma descoberto por engenharia reversa

### Alterado
- Arestas internas são reconectáveis apenas pela ponta de destino (mover a origem seria ambíguo); arestas para outros bots (externas) não são editáveis
- Falhas de reconexão exibem mensagem de erro no painel lateral em vez de falhar silenciosamente

### Corrigido
- Reconexão "não pegava" ao soltar no corpo do nó: o drop exigia acertar o handle de ~6px no topo — adicionados `connectionRadius={80}` e `reconnectRadius={16}`, handles maiores e destaque visual dos alvos válidos durante o arrasto (`.connectionindicator`)

---

## [0.5.0] - 2026-06-06

### Adicionado
- `ThemeContext` (`src/contexts/ThemeContext.tsx`) com hook `useTheme()` — distribui `isDark` via React Context sem prop drilling
- Script anti-flash em `index.html`: lê `localStorage` antes de o React montar para evitar piscar no carregamento

### Corrigido
- **Dark mode não afetava a plataforma inteira** — apenas a janela de preview (Background/MiniMap do canvas) respondia ao toggle; sidebar, nodes e painéis permaneciam estáticos
- **Causa raiz**: regras CSS `dark:*` do Tailwind (`.dark .dark\:bg-*`) não estavam presentes no bundle compilado pois o servidor foi iniciado antes de `darkMode: 'class'` ser adicionado ao `tailwind.config.js`; adicionar a classe `.dark` ao DOM não tinha efeito visual algum

### Alterado
- Arquitetura de tematização completamente reescrita: `dark:` prefix Tailwind removido de todos os arquivos — classes agora são computadas diretamente via ternário React (`isDark ? 'bg-slate-800' : 'bg-white'`)
- Todos os 8 node components, `JsonInput`, `DetailPanel`, `ExportControls` e `ThemeToggle` passam a consumir `useTheme()` ou receber `isDark` como prop
- `ThemeToggle` refatorado como componente controlado (recebe `isDark` + `onToggle` do `App.tsx`)

---

## [0.4.2] - 2026-06-06

### Adicionado
- Link **Documentação** ao lado do badge Beta no cabeçalho do sidebar (aponta para o repositório GitHub)

### Alterado
- Largura do sidebar aumentada de `w-72` para `w-96` para melhor legibilidade do JSON
- Itens do rodapé de legenda centralizados

---

## [0.4.1] - 2026-06-06

### Adicionado
- Badge de versão (`v0.4.1`) e **Beta** no cabeçalho do sidebar

### Corrigido
- Exportação PNG/SVG agora calcula dimensões a partir dos bounds reais dos nós (2× resolução, máx 8000 px) em vez de tamanho fixo 2400×1600 — fluxos grandes não ficam mais cortados
- `minZoom` reduzido de `0.3` para `0.01` no `ExportControls` para capturar fluxos muito grandes

---

## [0.4.0] - 2026-06-03

### Adicionado
- Botão toggle sol/lua para dark mode na sidebar com persistência em `localStorage`
- Cores dinâmicas no `Background` e `MiniMap` do React Flow de acordo com o tema ativo
- `tailwind.config.js` atualizado com `darkMode: 'class'`

### Nota
- A implementação via variantes `dark:` do Tailwind estava incompleta nesta versão: apenas o canvas (Background/MiniMap) respondia ao toggle. Corrigido definitivamente na [0.5.0].

---

## [0.3.0] - 2026-06-03

### Adicionado
- 2 novos tipos de nó — **Encerramento de conversa** (`EndConversationNode`, vermelho escuro) e **Chamada de API** (`ApiCallNode`, verde-azulado) — totalizando **10 tipos**
- Controles de espaçamento (`−` / `+`) no canto superior direito do canvas
- Espaçamento dinâmico e reconfigurável a cada geração (`ranksep` / `nodesep` em `parseFlow`)

### Corrigido
- MiniMap em branco no React Flow v12: adicionados `width`/`height` explícitos nos nós e `nodeComponent` SVG puro no `MiniMap`
- Codificação de caracteres especiais em nomes, mensagens e condições (`fixEncoding`)
- Rótulo incorreto em `ExternalBotNode` para bots externos sem nome definido

---

## [0.2.0] - 2026-06-03

### Adicionado
- **DetailPanel**: painel lateral com detalhes completos do nó selecionado — keywords, mensagens, condições, tipo de captura, destino de transferência e variáveis definidas
- 3 novos tipos de nó — **Aguarda interação** (`WaitNode`, ciano), **Atribuição de variável** (`SetDataNode`, índigo) e **Bot externo** (`ExternalBotNode`, âmbar)
- **Layout bin-packing** para fluxos com subgrafos desconectados: componentes isolados são posicionados lado a lado sem sobreposição
- Deploy automático no GitHub Pages via `gh-pages`

### Alterado
- `parseFlow` refatorado para suportar os novos tipos de nó com melhor separação de responsabilidades
- `ChoiceNode` passa a suportar o tipo lista (`action.type === "list"`) com ícone diferenciado

---

## [0.1.0] - 2026-06-02

### Adicionado
- Estrutura base do projeto: React 18 + Vite + TypeScript + Tailwind CSS
- Visualização de fluxo de chatbot a partir de JSON com propriedade `list`
- Layout hierárquico top-down automático via [Dagre](https://github.com/dagrejs/dagre)
- 5 tipos de nó: **Início** (verde), **Escolha** (azul), **Captura** (roxo), **Transferência** (vermelho) e **Padrão** (cinza)
- Rótulos nas arestas com o texto dos botões de escolha
- Zoom, pan e minimapa interativos via `@xyflow/react`
- Exportação em **PNG** (2400×1600) e **SVG** (vetor) via `html-to-image`
- Input via textarea (colar JSON) e upload de arquivo `.json`
- Atalho `Ctrl+Enter` para gerar o fluxo
