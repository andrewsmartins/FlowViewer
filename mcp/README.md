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

| Tool | O que faz |
|---|---|
| `list_nodes` | Mapa compacto do fluxo (1 linha por nó). |
| `describe_node` | Campos de um nó (gatilho, ação, mensagens, destino). |
| `describe_node_type` | Campos configuráveis de um tipo criável (sem arg = lista todos). |
| `create_node` | Cria um nó com os defaults do tipo; retorna o id. |
| `set_action_field` | Grava um campo do `action` (transferType, captureDataType, …). |
| `set_choices` | Define os destinos de um nó de Escolha. |
| `connect` | Liga origem→destino na 1ª vaga livre. |
| `validate` | Relatório de validade (erros bloqueiam export; avisos informam). |
| `revert` | Desfaz tudo desde a 1ª mutação da sessão. |
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

## Limitações conhecidas (spike → Fase 3)

- `set_action_field`/`connect` operam por `condIdx` (default 0) → nós-grupo
  (`intentGroupNode`, 2+ condições) só parcialmente endereçáveis.
- `setDataNode` (`bulkUpdate`) e o conteúdo de mensagem (LIST/BUTTON) ainda **não**
  são editáveis por tool.
