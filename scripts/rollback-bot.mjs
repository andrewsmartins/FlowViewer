/**
 * Rollback do bot de testes: restaura o estado de um arquivo de backup,
 * excluindo as intenções que existem hoje mas não estavam no backup.
 * Útil para limpar o bot após uma rodada de testes da Fase 4.
 *
 * NÃO recria intenções que estavam no backup e foram apagadas — só remove as
 * que sobraram (o caso comum: voltar o bot de testes ao estado inicial).
 *
 * Uso (PowerShell):
 *   $env:OMNI_TOKEN = 'r:...'
 *   node scripts/rollback-bot.mjs <botId> samples/backup-....json [--yes]
 *
 * Sem --yes é dry-run. Use somente em BOT DE TESTES.
 */
import { readFileSync } from 'node:fs'

const API = 'https://k0yowczqxg.execute-api.us-east-1.amazonaws.com/prod'
const APP_ID = 'UCeS99itvZg1tsea2OSoyKvpLbKddhoVAPotIQOy'

const [botId, backupPath] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const confirmed = process.argv.includes('--yes')
const token = process.env.OMNI_TOKEN

function abort(m) { console.error(`ABORTADO: ${m}`); process.exit(1) }
if (!botId || !backupPath) abort('uso: node scripts/rollback-bot.mjs <botId> <backup.json> [--yes]')
if (!token) abort("defina o token:  $env:OMNI_TOKEN = 'r:...'")

const headers = {
  accept: 'application/json',
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'x-omnichat-platform': 'web',
  'x-parse-application-id': APP_ID,
  'x-parse-session-token': token,
}

const backup = JSON.parse(readFileSync(backupPath, 'utf-8'))
const keepIds = new Set(backup.list.map(i => i.id))
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function listExtras() {
  const data = await (await fetch(`${API}/v1/${botId}/intents?fullObject=true`, { headers })).json()
  return { total: data.list.length, extras: data.list.filter(i => !keepIds.has(i.id)) }
}

const first = await listExtras()
console.log(`Backup mantém ${keepIds.size} intenção(ões). Servidor tem ${first.total}.`)
console.log(`A excluir: ${first.extras.length}`)
for (const i of first.extras) console.log(`  - ${i.name} (${i.id})`)

// Sem process.exit() após o fetch — process.exit() abrupto com sockets do fetch
// ainda abertos dispara uma assertion do libuv no Windows. Deixa o loop drenar.
if (!first.extras.length) {
  console.log('Nada a fazer.')
} else if (!confirmed) {
  console.log('\nDRY-RUN — adicione --yes para excluir.')
} else {
  // A API responde DELETE com 200 mas a remoção é de consistência EVENTUAL:
  // um GET logo depois ainda lista parte das intenções "deletadas" (lag de
  // réplica de leitura). Por isso o rollback é um laço deletar → esperar →
  // reverificar, até o servidor confirmar que só restou o que o backup mantém.
  const MAX_ROUNDS = 6
  const WAIT_MS = 4000
  let round = 0
  let extras = first.extras
  while (extras.length && round < MAX_ROUNDS) {
    round++
    console.log(`\nRodada ${round}: removendo ${extras.length}…`)
    for (const intent of extras) {
      const res = await fetch(`${API}/v1/${botId}/intents/${intent.id}`, { method: 'DELETE', headers })
      console.log(`  DELETE ${intent.name} -> ${res.status}`)
    }
    await sleep(WAIT_MS)
    extras = (await listExtras()).extras
  }
  if (extras.length) {
    console.error(`\nFALHA: após ${MAX_ROUNDS} rodadas ainda restam ${extras.length} intenção(ões) — verifique manualmente na tela da Omni:`)
    for (const i of extras) console.error(`  - ${i.name} (${i.id})`)
    process.exitCode = 1
  } else {
    console.log('\nRollback concluído e CONFIRMADO via GET — só restou o que o backup mantém.')
  }
}
