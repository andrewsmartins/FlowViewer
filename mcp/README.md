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

## Limitações conhecidas (spike → Fase 3)

- `set_action_field`/`connect` operam por `condIdx` (default 0) → nós-grupo
  (`intentGroupNode`, 2+ condições) só parcialmente endereçáveis.
- `setDataNode` (`bulkUpdate`) e o conteúdo de mensagem (LIST/BUTTON) ainda **não**
  são editáveis por tool.
- Resolução de **nome → ID** de time/usuário/API (campos `value`/`apiName`) chega
  na **Fase 4** (resolvers sobre a API OmniChat). Até lá o agente não deve inventar
  IDs — deve parar e perguntar.
