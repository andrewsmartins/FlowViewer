/**
 * Upload de mídia para a OmniChat via presigned URL (S3) — Fase 8.
 *
 * Fluxo em 2 passos (presigned POST do S3 — formato confirmado por captura de rede):
 *   1. POST /files/v1/presigned-url com { type, name, mimeType } e Bearer token
 *      → devolve { attachmentUrl, url, fields } (ver PresignedUrlResponse abaixo)
 *   2. POST multipart/form-data em `url`, com todos os `fields` + o arquivo como
 *      ÚLTIMO campo (`file`). Sem Authorization e sem Content-Type manual: é o S3
 *      que valida via `fields` (policy/assinatura), e o browser põe o boundary.
 *   `attachmentUrl` é a URL pública permanente, gravada em BotMessage.content.
 *
 * CORS: o host `private-api2.omni.chat` é um AWS API Gateway com Allow-Origin `*`,
 * mas o preflight só permite Authorization/Content-Type/x-omnichat-platform(-version).
 * Os headers x-parse-* da API de intents NÃO são aceitos aqui (bloqueiam o preflight).
 *
 * Segurança: o token vai só no header do passo 1 e NUNCA é logado.
 */

const FILES_API = 'https://private-api2.omni.chat/files'
// Versão do app web da OmniChat — o gateway de arquivos exige este header (401 sem ele).
// Valor fixo capturado da plataforma; atualizar se a API passar a recusar versões antigas.
const PLATFORM_VERSION = '1.116.16'

export type UploadMediaType = 'IMAGE' | 'FILE' | 'VIDEO'

type ApiMediaType = 'image' | 'document' | 'video'

/** Campos da resposta de /files/v1/presigned-url (presigned POST do S3). */
interface PresignedUrlResponse {
  /** URL pública permanente do arquivo — gravada em BotMessage.content. */
  attachmentUrl: string
  /** Endpoint do bucket S3 — alvo do POST multipart com os `fields` + o arquivo. */
  url: string
  /** Campos exigidos pelo S3 (key, policy, X-Amz-*) — vão no form antes do arquivo. */
  fields: Record<string, string>
}

const TYPE_MAP: Record<UploadMediaType, { apiType: ApiMediaType; accept: string }> = {
  IMAGE: { apiType: 'image',    accept: 'image/*' },
  FILE:  { apiType: 'document', accept: 'application/pdf' },
  VIDEO: { apiType: 'video',    accept: 'video/*' },
}

/** Valor do atributo `accept` para o <input type="file"> conforme o tipo de mídia. */
export function acceptFor(type: UploadMediaType): string {
  return TYPE_MAP[type].accept
}

/**
 * Executa um `fetch` rotulando qual passo do upload falhou. O `fetch` pode lançar
 * de forma síncrona (ex.: header com caractere fora do Latin-1) — sem este wrapper,
 * o erro não diria se veio do passo 1 ou 2. Nunca inclui o token na mensagem.
 */
async function requestStep(step: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run()
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Falha de rede no ${step}: ${reason}`)
  }
}

/**
 * Faz upload de um arquivo para a OmniChat e devolve a URL pública permanente + nome.
 * Lança Error descritivo (sem expor o token) se qualquer passo falhar.
 */
export async function uploadMedia(
  file: File,
  type: UploadMediaType,
  token: string,
): Promise<{ content: string; fileName: string }> {
  const { apiType } = TYPE_MAP[type]

  // Passo 1: solicitar presigned URL à API da OmniChat
  const res = await requestStep('passo 1 (presigned-url)', () => fetch(`${FILES_API}/v1/presigned-url`, {
    method: 'POST',
    // O serviço de arquivos é um AWS API Gateway (host private-api2), NÃO o Parse
    // Server dos intents. O preflight só aceita Authorization/Content-Type/
    // x-omnichat-platform — enviar x-parse-* faz o navegador bloquear por CORS.
    headers: {
      accept: 'application/json, text/plain, */*',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-omnichat-platform': 'web',
      'x-omnichat-platform-version': PLATFORM_VERSION,
    },
    body: JSON.stringify({ type: apiType, name: file.name, mimeType: file.type }),
  }))

  if (!res.ok) {
    const excerpt = await res.text().catch(() => '')
    throw new Error(
      `Erro ao solicitar URL de upload (${res.status})` +
      (excerpt ? `: ${excerpt.slice(0, 200)}` : ''),
    )
  }

  const data = (await res.json()) as PresignedUrlResponse
  if (!data.attachmentUrl || !data.url || !data.fields) {
    // Lista só os NOMES das chaves (nunca os valores: podem conter credenciais AWS).
    const keys = data && typeof data === 'object' ? Object.keys(data).join(', ') : typeof data
    throw new Error(
      'Resposta inesperada do servidor — campos attachmentUrl/url/fields ausentes. ' +
      `Campos recebidos: [${keys}]. Verifique uploadMedia.ts:PresignedUrlResponse.`,
    )
  }

  // Passo 2: enviar o arquivo ao S3 via presigned POST (sem token OmniChat).
  // Os `fields` (policy, assinatura, key) vão primeiro; o `file` precisa ser o
  // ÚLTIMO campo do form. Não definimos Content-Type: o browser monta o
  // multipart/form-data com o boundary correto sozinho.
  const form = new FormData()
  for (const [name, value] of Object.entries(data.fields)) form.append(name, value)
  form.append('file', file)

  const post = await requestStep('passo 2 (envio ao armazenamento)', () => fetch(data.url, {
    method: 'POST',
    body: form,
  }))
  if (!post.ok) {
    throw new Error(`Erro ao enviar arquivo para o armazenamento (${post.status})`)
  }

  return { content: data.attachmentUrl, fileName: file.name }
}
