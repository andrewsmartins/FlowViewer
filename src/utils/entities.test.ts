import { describe, it, expect } from 'vitest'
import { fetchStoreEntities } from './entities'
import type { FetchLike } from './pushFlow'

const TOKEN = 'r:fake-session-token'
const BOT = '2a3859ff-62d5-4c01-ae60-6ae2f812e786'

interface RecordedCall {
  url: string
  headers: Record<string, string>
}

/** fetch mockado: grava as chamadas e responde via `responder`. Sem rede. */
function recordingFetch(
  responder: (call: RecordedCall, index: number) => { status: number; body: unknown },
): { fetch: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fetch: FetchLike = async (url, init) => {
    const call: RecordedCall = { url, headers: init.headers }
    const index = calls.length
    calls.push(call)
    const { status, body } = responder(call, index)
    const text = JSON.stringify(body)
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
      json: async () => JSON.parse(text),
    }
  }
  return { fetch, calls }
}

describe('fetchStoreEntities — lista as Listas (entities) do bot', () => {
  const entitiesBody = {
    list: [
      { id: '97f92ce3-ae7c-40cf-bbf7-5e6ab1858280', name: 'Endereco', type: 'store' },
      { id: 'b1c2d3', name: 'Atributos', type: 'values' },
    ],
  }

  it('mapeia para {id, name, type}, ordena por nome e bate no endpoint por botId', async () => {
    const { fetch, calls } = recordingFetch(() => ({ status: 200, body: entitiesBody }))
    const entities = await fetchStoreEntities({ fetch, token: TOKEN, botId: BOT })
    expect(entities).toEqual([
      { id: 'b1c2d3', name: 'Atributos', type: 'values' },
      { id: '97f92ce3-ae7c-40cf-bbf7-5e6ab1858280', name: 'Endereco', type: 'store' },
    ])
    // endpoint por botId direto (sem passo retailerId)
    expect(calls[0].url).toContain(`/v1/${BOT}/entities`)
    // token só nos headers de sessão (Bearer + x-parse-session-token)
    expect(calls[0].headers.authorization).toBe(`Bearer ${TOKEN}`)
    expect(calls[0].headers['x-parse-session-token']).toBe(TOKEN)
  })

  it('usa o id como rótulo quando a lista não tem name e type vazio quando ausente', async () => {
    const { fetch } = recordingFetch(() => ({ status: 200, body: { list: [{ id: 'sem-nome' }] } }))
    expect(await fetchStoreEntities({ fetch, token: TOKEN, botId: BOT })).toEqual([
      { id: 'sem-nome', name: 'sem-nome', type: '' },
    ])
  })

  it('ignora entradas sem id e trata lista ausente como vazia', async () => {
    const { fetch } = recordingFetch(() => ({ status: 200, body: { list: [{ name: 'sem id' }, { id: 'ok', name: 'Ok', type: 'store' }] } }))
    expect(await fetchStoreEntities({ fetch, token: TOKEN, botId: BOT })).toEqual([
      { id: 'ok', name: 'Ok', type: 'store' },
    ])
    const empty = recordingFetch(() => ({ status: 200, body: {} }))
    expect(await fetchStoreEntities({ fetch: empty.fetch, token: TOKEN, botId: BOT })).toEqual([])
  })

  it('lança quando a leitura falha (status != 2xx), sem expor o token', async () => {
    const { fetch } = recordingFetch(() => ({ status: 403, body: { error: 'denied' } }))
    const promise = fetchStoreEntities({ fetch, token: TOKEN, botId: BOT })
    await expect(promise).rejects.toThrow(/status 403/)
    await expect(promise).rejects.not.toThrow(new RegExp(TOKEN))
  })
})
