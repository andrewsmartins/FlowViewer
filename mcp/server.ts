#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, resolve, isAbsolute } from 'node:path'
import { existsSync } from 'node:fs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { FlowStore } from '../src/tools/flowStore'
import {
  createNode, setActionField, setNodeChoices, connectNodes,
  validate, revert, listNodes, describeNode,
  ACTION_FIELDS, type ActionFieldName,
} from '../src/tools/flowTools'
import { manifest, describeNodeType } from './nodeCatalog'

/**
 * Servidor MCP local (Fase 3, PLANS.md § "Fase 3"). Expõe a camada de tools já
 * pronta (`src/tools/flowTools.ts`) como ferramentas que o Claude Code lança por
 * STDIO — zero portas, zero rede de entrada. A camada de tools é a peça durável;
 * aqui só se adiciona o transporte (decisão Q6: mesmo repo, importa `src/utils`
 * direto, roda via `tsx`, SDK `@modelcontextprotocol/sdk`).
 *
 * IMPORTANTE: em stdio, o stdout é o canal do protocolo — TODO log vai para
 * stderr (`console.error`). Escrever em stdout corromperia as mensagens MCP.
 */

// --- Localização do arquivo de fluxo ----------------------------------------
// Uma FlowStore por processo (modelo natural do stdio): o arquivo é carregado na
// subida e mantido em memória; o snapshot/revert vale por toda a vida do
// processo (= a sessão, Q3). Origem do caminho, em ordem: FLOW_FILE (env) →
// 1º argumento de CLI → default public/masterFlow.json.
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const defaultFlow = resolve(repoRoot, 'public', 'masterFlow.json')

function resolveFlowPath(): string {
  const raw = process.env.FLOW_FILE ?? process.argv[2]
  if (!raw) return defaultFlow
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw)
}

const flowPath = resolveFlowPath()
if (!existsSync(flowPath)) {
  console.error(`[flow-mcp] arquivo de fluxo não encontrado: ${flowPath}`)
  console.error('[flow-mcp] defina FLOW_FILE (env) ou passe o caminho como 1º argumento.')
  process.exit(1)
}

const store = FlowStore.fromFile(flowPath)
console.error(
  `[flow-mcp] fluxo carregado: ${flowPath} ` +
  `(${store.flow.list.length} nós, bot ${store.mainBotId || '<sem início>'})`,
)

// --- Instruções sempre no contexto do agente --------------------------------
const instructions = [
  'Editor de fluxos de bot OmniChat por FERRAMENTAS. Você constrói e edita nós',
  'operando estas tools — NUNCA escreva JSON cru. A validade vive no código das tools.',
  '',
  'Trabalho típico: list_nodes (orientar) → describe_node (inspecionar) → create_node →',
  'set_action_field / set_choices → connect → validate. Use revert para desfazer tudo',
  'desde o início da sessão.',
  '',
  'Regras:',
  '- Referencie nós por id OU nome exato (nome ambíguo é erro — use o id).',
  '- Nunca invente IDs de time/usuário/API (campos value, apiName). Nesta fase eles não',
  '  são resolvidos automaticamente; pare e pergunte ao humano.',
  '- describe_node_type(kind) detalha os campos de cada tipo (sem kind, lista todos).',
  '',
  'Tipos de nó criáveis:',
  manifest(),
].join('\n')

const server = new McpServer(
  { name: 'omnichat-flow-editor', version: '0.1.0' },
  { instructions },
)

/** Empacota a confirmação compacta da tool no formato de conteúdo do MCP. */
const reply = (textOut: string) => ({ content: [{ type: 'text' as const, text: textOut }] })

// --- Tools de leitura --------------------------------------------------------
server.registerTool('list_nodes', {
  title: 'Listar nós',
  description: 'Mapa compacto do fluxo: uma linha por nó (nome, id, kind, categoria, destino).',
  inputSchema: {},
}, async () => reply(listNodes(store)))

server.registerTool('describe_node', {
  title: 'Descrever nó',
  description: 'Campos de UM nó (gatilho, ação, mensagens, destino) — para inspecionar antes de editar.',
  inputSchema: { node: z.string().describe('id ou nome do nó') },
}, async ({ node }) => reply(describeNode(store, node)))

server.registerTool('describe_node_type', {
  title: 'Descrever tipo de nó',
  description: 'Detalha os campos configuráveis de um tipo de nó criável (kind). Sem argumento, lista todos.',
  inputSchema: { kind: z.string().optional().describe('kind do nó, ex.: captureNode') },
}, async ({ kind }) => reply(kind ? describeNodeType(kind) : manifest()))

// --- Tools de mutação --------------------------------------------------------
server.registerTool('create_node', {
  title: 'Criar nó',
  description: 'Cria um nó com os defaults do tipo. Retorna o id, usado como referência nas demais tools.',
  inputSchema: {
    kind: z.string().describe('tipo do nó (ver describe_node_type)'),
    name: z.string().describe('nome da intenção'),
  },
}, async ({ kind, name }) => reply(createNode(store, kind, name)))

server.registerTool('set_action_field', {
  title: 'Definir campo da ação',
  description: 'Grava um campo do action de um nó (ex.: transferType, captureDataType, orderType). Lista só em multipleFields.',
  inputSchema: {
    node: z.string().describe('id ou nome do nó'),
    field: z.enum(ACTION_FIELDS).describe('campo a gravar'),
    value: z.union([z.string(), z.array(z.string())]).describe('valor (lista só para multipleFields)'),
    condIdx: z.number().int().nonnegative().optional().describe('índice da condição (default 0)'),
  },
}, async ({ node, field, value, condIdx }) =>
  reply(setActionField(store, node, field as ActionFieldName, value, condIdx ?? 0)))

server.registerTool('set_choices', {
  title: 'Definir escolhas',
  description: 'Define os destinos de um nó de Escolha (posicionais com os itens do menu). Vazio = slot sem destino.',
  inputSchema: {
    node: z.string().describe('id ou nome do nó de escolha'),
    destinations: z.array(z.string()).describe('ids ou nomes dos destinos (na ordem dos itens)'),
  },
}, async ({ node, destinations }) => reply(setNodeChoices(store, node, destinations)))

server.registerTool('connect', {
  title: 'Conectar nós',
  description: 'Liga origem→destino na 1ª vaga livre (next ou slot de escolha).',
  inputSchema: {
    source: z.string().describe('id ou nome da origem'),
    target: z.string().describe('id ou nome do destino'),
  },
}, async ({ source, target }) => reply(connectNodes(store, source, target)))

server.registerTool('validate', {
  title: 'Validar fluxo',
  description: 'Relatório de validade (erros bloqueiam export; avisos só informam).',
  inputSchema: {},
}, async () => reply(validate(store)))

server.registerTool('revert', {
  title: 'Reverter',
  description: 'Desfaz tudo desde a 1ª mutação da sessão (snapshot de storage).',
  inputSchema: {},
}, async () => reply(revert(store)))

// --- Conecta o transporte stdio ----------------------------------------------
const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[flow-mcp] servidor pronto (stdio).')
