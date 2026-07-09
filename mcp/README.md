# MCP — Editor de fluxos OmniChat (servidor local)

Servidor [MCP](https://modelcontextprotocol.io) que expõe a camada de tools do
agente ([`src/tools/flowTools.ts`](../src/tools/flowTools.ts)) como ferramentas
que o **Claude Code** lança por **stdio**. É a Fase 3 da feature "Agente de IA
que constrói nós" (ver [`PLANS.md`](../PLANS.md)).

O agente **constrói e edita nós operando ferramentas — nunca escrevendo JSON
cru**. A validade vive no código das tools; o modelo só orquestra.

## Arquitetura

```
Claude Code  ──(stdio, subprocesso)──▶  mcp/server.ts
                                          │ importa direto
                                          ▼
                                src/tools/flowTools.ts  (tools)
                                src/tools/flowStore.ts  (storage + .bak/revert)
                                          │ lê/escreve
                                          ▼
                                  arquivo de fluxo (FLOW_FILE)
```

Zero portas e zero rede de entrada — o único tráfego é o stdio com o Claude Code.
O site (gh-pages) **não** fala com o MCP; eles só se cruzam pelo arquivo de fluxo
em disco.

## Como rodar

Pré-requisitos: `npm install` (instala `tsx`, `@modelcontextprotocol/sdk`, `zod`).

O Claude Code já está configurado em [`.mcp.json`](../.mcp.json) na raiz do repo —
ao abrir o projeto, o servidor sobe automaticamente. As tools aparecem como
`mcp__omnichat-flow-editor__*`.

Para rodar manualmente (debug):

```bash
npm run mcp                       # opera public/masterFlow.json (default)
FLOW_FILE=caminho/do/fluxo.json npm run mcp
npx tsx mcp/server.ts outro.json  # caminho como 1º argumento
```

Logs vão para **stderr** (stdout é o canal do protocolo MCP).

### Qual arquivo é editado

Ordem de resolução do caminho: `FLOW_FILE` (env) → 1º argumento de CLI →
`public/masterFlow.json` (default). Uma única `FlowStore` por processo carrega o
arquivo na subida e o mantém em memória; o `revert` desfaz tudo desde a 1ª
mutação da sessão (= vida do processo). Toda mutação grava um `.bak` ao lado do
arquivo na 1ª escrita.

## Ferramentas expostas

São **24 tools** no total: 3 de leitura, 13 de mutação e 8 resolvers (nome → ID contra a API). Fonte da verdade: os `registerTool(...)` em [`server.ts`](server.ts).

### Leitura (inspecionar antes de editar)

| Tool | O que faz |
|---|---|
| `list_nodes` | Mapa compacto do fluxo (1 linha por nó: nome, id, kind, categoria, destino). |
| `describe_node` | Campos de UM nó (gatilho, ação, mensagens, destino). |
| `describe_node_type` | Campos configuráveis de um tipo criável (sem arg = lista todos). |

### Mutação (constroem e editam o fluxo)

| Tool | O que faz |
|---|---|
| `create_node` | Cria um nó com os defaults do tipo; retorna o id (referência das demais tools). |
| `set_message` | Grava o texto (TEXT) da mensagem de um nó (não serve para nó de Escolha — use `set_menu`). |
| `set_category` | Grava a categoria da intenção (agrupa o fluxo); reutilize uma categoria existente. |
| `set_keywords` | SUBSTITUI as palavras-chave da intenção-ALVO — é o que ROTEIA botão/lista (casamento "contém"). |
| `set_context` | Escopa a keyword de uma intenção a UM menu (ou limpa → keyword global). |
| `set_menu` | Cria a mensagem de itens (BUTTON/LIST) de um nó de Escolha; infere BUTTON vs LIST. |
| `set_choices` | Define os destinos posicionais de um nó de Escolha. |
| `set_transfer` | Preenche o nó de Transferência: categoria (1 dos 6 tipos) + destino resolvido por nome → ID. |
| `set_action_field` | Grava um campo do `action` (`captureDataType`, `orderType`, `storeType`, …). `transferType` → use `set_transfer`. |
| `connect` | Liga origem→destino na 1ª vaga livre (next ou slot de escolha). |
| `connect_to_bot` | Redireciona o `next` de um nó para uma intenção de OUTRO bot (redirect cross-bot). |
| `validate` | Relatório de validade (erros bloqueiam export; avisos informam). |
| `revert` | Desfaz tudo desde a 1ª mutação da sessão. |

### Resolvers (nome → ID, read-only contra a API)

| Tool | O que faz |
|---|---|
| `find_team` / `list_teams` | Resolve/lista os times da loja → `objectId` (transfer). |
| `find_user` | Resolve um vendedor (usuário supervisionado) → `objectId`. Busca server-side. |
| `find_bot` / `list_bots` | Resolve/lista os bots ativos da conta → `botId` (redirect cross-bot). |
| `list_api_integrations` | APIs (endpoints) do bot → `apiName`. |
| `list_entities` | Listas (entities) do bot → `@entity` / nó Loja física. |
| `list_intents` | Intenções de **outro** bot (nome \| id); com nome, resolve via match. |

### Resolvers (Fase 4) — token e segurança

As 6 famílias de resolver (8 tools) são **read-only contra a API OmniChat** e
resolvem **nome → ID real** (mata ID alucinado). O `OMNI_TOKEN` é lido do
[`flow-viewer.env`](../flow-viewer.env) na raiz no startup (o `.mcp.json` é
commitado e só injeta `FLOW_FILE`) — o token vive na camada de tools, **nunca
chega ao modelo nem é logado**. Token ausente → "configure OMNI_TOKEN"; **401/403
→ "renove o OMNI_TOKEN", sem retry** (token de sessão Parse expira rápido). O
`botId` vem do flow file (`store.mainBotId`). Match ambíguo/parcial devolve
candidatos e o modelo **para e pergunta** — nunca auto-escolhe.

Smoke read-only real: `npx tsx scripts/smoke-phase4-resolvers.ts [nomeDoTime]`.

## Limitações conhecidas

- `set_action_field`/`connect` operam por `condIdx` (default 0) → nós-grupo
  (`intentGroupNode`, 2+ condições) só parcialmente endereçáveis.
- `setDataNode` (`bulkUpdate`) ainda **não** é editável por tool. O conteúdo de
  mensagem já é: TEXT via `set_message`, BUTTON/LIST via `set_menu`.
