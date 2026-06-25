/**
 * Passo 3 do plano "Caixinha de chat na página — PoC local do agente"
 * (PLANS.md § "Caixinha de chat na página").
 *
 * Servidor local que faz a ponte entre o browser (WebSocket) e o Claude Agent
 * SDK — uma sessão do SDK por conexão WS; contexto e MCP persistem entre turnos
 * via option `resume`. O arquivo de trabalho é descartável (tmpdir) e nunca
 * toca o public/masterFlow.json canônico.
 *
 * Uso: npx tsx backend/server.ts
 *      PORT=4001 npx tsx backend/server.ts   (override da porta)
 */
import { createServer } from 'node:http'
import { readFileSync, copyFileSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { WebSocketServer, WebSocket } from 'ws'
import { query } from '@anthropic-ai/claude-agent-sdk'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const mcpServer = join(repoRoot, 'mcp', 'server.ts')
const seedFlow = join(repoRoot, 'public', 'masterFlow.json')
const htmlFile = join(here, 'index.html')
const PORT = Number(process.env.PORT ?? 4000)
const MCP_NAME = 'omnichat-flow-editor'

// Cópia descartável do fluxo — nunca o canônico.
const workDir = mkdtempSync(join(tmpdir(), 'flow-ws-'))
const workFile = join(workDir, 'work.flow.json')
copyFileSync(seedFlow, workFile)

// ── HTTP: serve index.html ────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(readFileSync(htmlFile, 'utf8'))
  } else {
    res.writeHead(404)
    res.end('not found')
  }
})

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws: WebSocket) => {
  console.log('[ws] cliente conectado')

  let running = false
  let sessionId: string | undefined  // para resume entre turnos

  const send = (payload: object) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }

  ws.on('message', async (data: Buffer) => {
    const prompt = data.toString().trim()
    if (!prompt) return

    if (running) {
      send({ type: 'error', message: 'Turno em andamento — aguarde antes de enviar.' })
      return
    }

    running = true
    send({ type: 'status', text: 'Pensando…' })
    console.log(`[ws] turno iniciado${sessionId ? ' (resume ' + sessionId.slice(0, 8) + '…)' : ''}`)

    try {
      const run = query({
        prompt,
        options: {
          cwd: repoRoot,
          settingSources: [],          // evita carregar .mcp.json e subir 2º MCP
          ...(sessionId ? { resume: sessionId } : {}),
          mcpServers: {
            [MCP_NAME]: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', 'tsx', mcpServer],
              env: { ...process.env, FLOW_FILE: workFile },
            },
          },
          permissionMode: 'bypassPermissions',
          maxTurns: 20,
        },
      })

      for await (const msg of run) {
        if (msg.type === 'system' && msg.subtype === 'init') {
          // Captura sessionId na primeira mensagem para resume futuro.
          sessionId = msg.session_id
        } else if (msg.type === 'assistant') {
          for (const block of (msg.message as { content: Array<{ type: string; text?: string; name?: string; input?: unknown }> })?.content ?? []) {
            if (block.type === 'text' && block.text?.trim()) {
              send({ type: 'text', text: block.text })
            } else if (block.type === 'tool_use') {
              // Remove o prefixo verbose do MCP para a UI.
              const toolName = (block.name as string).replace(`mcp__${MCP_NAME}__`, '')
              send({ type: 'tool', name: toolName, input: block.input })
              console.log(`[ws]   tool: ${toolName}`)
            }
          }
        } else if (msg.type === 'result' && (msg as { is_error?: boolean }).is_error) {
          send({ type: 'error', message: `Erro no turno: ${(msg as { subtype?: string }).subtype ?? 'desconhecido'}` })
        }
      }

      // Fim do turno: lê o arquivo e manda o número de nós p/ a UI.
      const flowJson = JSON.parse(readFileSync(workFile, 'utf8')) as { list?: unknown[] }
      const nodeCount = flowJson.list?.length ?? 0
      send({ type: 'flow-updated', nodeCount })
      send({ type: 'done' })
      console.log(`[ws] turno concluído — ${nodeCount} nó(s) no fluxo`)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[ws] erro:', errMsg)
      if (/login|auth|unauthor|credential|oauth/i.test(errMsg)) {
        send({ type: 'error', message: 'Falha de autenticação. Rode `claude /login` e reinicie o servidor.' })
      } else {
        send({ type: 'error', message: errMsg })
      }
    } finally {
      running = false
    }
  })

  ws.on('close', () => console.log('[ws] cliente desconectado'))
})

httpServer.listen(PORT, () => {
  console.log(`[ws-server] http://localhost:${PORT}`)
  console.log(`[ws-server] arquivo de trabalho: ${workFile}`)
  console.log(`[ws-server] Ctrl+C para parar`)
})
