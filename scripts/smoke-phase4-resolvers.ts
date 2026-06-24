/**
 * Smoke read-only da Fase 4 (resolvers nome → ID). TOCA A API REAL da OmniChat
 * (times do bot de testes) — é a rede de segurança contra drift do contrato da
 * API interna não documentada (risco registrado no PLANS.md § "Fase 4").
 *
 * Read-only: só LÊ da API (lista/resolve times); não escreve nada, nem local nem
 * remoto. Usa o `public/masterFlow.json` só para o `botId` (fonte única, decisão 1).
 *
 * Uso (PowerShell):
 *   $env:OMNI_TOKEN = 'r:...'   # ou deixe no flow-viewer.env (lido automaticamente)
 *   npx tsx scripts/smoke-phase4-resolvers.ts [nomeDoTime]
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { FlowStore } from '../src/tools/flowStore'
import { Resolvers } from '../src/tools/resolvers'
import type { FetchLike } from '../src/utils/pushFlow'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

function loadOmniToken(): string {
  if (process.env.OMNI_TOKEN) return process.env.OMNI_TOKEN
  const envPath = resolve(repoRoot, 'flow-viewer.env')
  if (!existsSync(envPath)) return ''
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*OMNI_TOKEN\s*=\s*(.*)$/.exec(line)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

const nodeFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init)
  return { ok: res.ok, status: res.status, text: () => res.text(), json: () => res.json() }
}

async function main() {
  const token = loadOmniToken()
  if (!token) {
    console.error("defina o token antes:  $env:OMNI_TOKEN = 'r:...'  (ou flow-viewer.env)")
    process.exit(1)
  }
  const store = FlowStore.fromFile(resolve(repoRoot, 'public', 'masterFlow.json'))
  console.log(`[smoke] bot do fluxo: ${store.mainBotId || '<sem início>'}`)
  const resolvers = new Resolvers(store, { fetch: nodeFetch, token })

  console.log('\n[smoke] list_teams():')
  console.log(await resolvers.listTeams())

  const query = process.argv[2] ?? 'Financeiro'
  console.log(`\n[smoke] find_team(${JSON.stringify(query)}):`)
  console.log(await resolvers.findTeam(query))
}

main().catch(e => { console.error('[smoke] falhou:', e); process.exit(1) })
