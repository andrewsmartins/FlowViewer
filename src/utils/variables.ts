/**
 * Catálogo de variáveis de sistema da plataforma OmniChat, organizado em grupos
 * com rótulos legíveis — alimenta o picker de `@` (ex.: condição "O valor está
 * vazio"). O front EXIBE o rótulo amigável ("Consumidor › Nome"), mas GRAVA a
 * variável crua no objeto (`@customer.name#normalizeQuery`).
 *
 * É uma lista CURADA/estática: a plataforma não expõe isso por API. Regras:
 *  - `value` é a base da variável. Quando há UMA combinação só, o `#modificador`
 *    (quando existe) já vem embutido em `value` (não há escolha a fazer).
 *  - `modifiers` só aparece quando há 2+ combinações fornecidas para a variável —
 *    aí o picker mostra uma 3ª etapa e o valor final é `value + suffix`.
 *  - Itens/grupos com `prefix: true` inserem um prefixo e liberam digitação: o
 *    campo personalizado (ID por-conta) e os namespaces "pelados" (@api, @custom,
 *    @entity, @team, @flow), completados à mão.
 */

export interface VariableModifier {
  /** Rótulo amigável (ex.: "Só dígitos", "Sem modificador"). */
  label: string
  /** Sufixo gravado após a base (ex.: "#onlyNumbers"); "" = sem modificador. */
  suffix: string
}

export interface VariableItem {
  /** Rótulo amigável exibido no picker (ex.: "Número"). */
  label: string
  /** Base da variável crua (ex.: "@store.number"; com modificador embutido se único). */
  value: string
  /** true: insere como prefixo e libera digitação (ID por-conta / namespace livre). */
  prefix?: boolean
  /** Opções de modificador (etapa final) — só quando há escolha real (2+). */
  modifiers?: VariableModifier[]
}

export interface VariableGroup {
  /** Namespace (chave interna). */
  key: string
  /** Rótulo amigável da categoria (ex.: "Consumidor"). */
  label: string
  /** Categoria "folha": selecionar a categoria insere este valor (prefixo livre). */
  value?: string
  /** Itens da categoria (picker em níveis). */
  items?: VariableItem[]
}

const DAY_LABELS: Record<string, string> = {
  monday: 'segunda', tuesday: 'terça', wednesday: 'quarta', thursday: 'quinta',
  friday: 'sexta', saturday: 'sábado', sunday: 'domingo',
}

/** Modificadores de hora — aplicados a abertura/fechamento de cada dia. */
const TIME_MODIFIERS: VariableModifier[] = [
  { label: 'Hora', suffix: '#getHourOfDate' },
  { label: 'Hora e minuto', suffix: '#getHoursAndMinutesOfDate' },
]

/** Itens de horário do bot: {Abertura|Fechamento} × 7 dias, cada um com 2 modificadores. */
function botScheduleItems(): VariableItem[] {
  const out: VariableItem[] = []
  const fields: Array<[string, string]> = [['openingTime', 'Abertura'], ['closingTime', 'Fechamento']]
  for (const [field, fieldLabel] of fields) {
    for (const [day, dayLabel] of Object.entries(DAY_LABELS)) {
      out.push({ label: `${fieldLabel} ${dayLabel}`, value: `@bot.${field}.${day}`, modifiers: TIME_MODIFIERS })
    }
  }
  return out
}

export const VARIABLE_GROUPS: VariableGroup[] = [
  {
    key: 'customer', label: 'Consumidor', items: [
      { label: 'Nome', value: '@customer.name#normalizeQuery' },
      { label: 'Sobrenome', value: '@customer.lastName#normalizeQuery' },
      { label: 'E-mail', value: '@customer.email#onlyNumbers' },
      { label: 'CPF', value: '@customer.taxDocumentNumber#onlyNumbers' },
      { label: 'CNPJ', value: '@customer.businessTaxId#onlyNumbers' },
      { label: 'Código do país (telefone)', value: '@customer.phoneCountryCode' },
      { label: 'ID do contato', value: '@customer.objectId' },
      { label: 'Código de área', value: '@customer.areaCode' },
      { label: 'DDD', value: '@customer.ddd' },
      { label: 'Telefone', value: '@customer.phoneNumber' },
      {
        label: 'Data de nascimento', value: '@customer.birthDate', modifiers: [
          { label: 'Data ISO', suffix: '#formatIsoDate' },
          { label: 'Sem modificador', suffix: '' },
        ],
      },
      { label: 'Consentimento LGPD', value: '@customer.consentLGPD' },
      { label: 'Gênero', value: '@customer.gender' },
      { label: 'ID externo', value: '@customer.externalId' },
      { label: 'Endereço', value: '@customer.address' },
      { label: 'Campo personalizado…', value: '@customer.customFields.', prefix: true },
    ],
  },
  {
    key: 'channel', label: 'Canal', items: [
      { label: 'ID do canal', value: '@channel.id' },
      { label: 'Tipo do canal', value: '@channel.type' },
    ],
  },
  {
    key: 'bot', label: 'Bot', items: [
      { label: 'Está aberto agora', value: '@bot.isOpenNow' },
      { label: 'Nome do bot', value: '@bot.name#normalizeQuery' },
      ...botScheduleItems(),
    ],
  },
  { key: 'entity', label: 'Lista', value: '@entity' },
  {
    key: 'store', label: 'Loja', items: [
      { label: 'Nome da loja', value: '@store.name' },
      { label: 'Telefone da loja', value: '@store.phone' },
      { label: 'Endereço (linha 1)', value: '@store.addressLine1#normalizeQuery' },
      { label: 'Bairro', value: '@store.suburb#normalizeQuery' },
      { label: 'Endereço (linha 2)', value: '@store.addressLine2#normalizeQuery' },
      {
        label: 'Número', value: '@store.number', modifiers: [
          { label: 'Só dígitos', suffix: '#onlyNumbers' },
          { label: 'Texto', suffix: '#normalizeQuery' },
        ],
      },
      { label: 'Cidade', value: '@store.city#normalizeQuery' },
      { label: 'Estado', value: '@store.state#normalizeQuery' },
      { label: 'CEP', value: '@store.zip#zipcode' },
      { label: 'Identificador', value: '@store.identificator#normalizeQuery' },
    ],
  },
  { key: 'api', label: 'API', value: '@api' },
  { key: 'custom', label: 'Personalizado', value: '@custom' },
  {
    key: 'order', label: 'Pedido', items: [
      { label: 'Total', value: '@order.totalFetched#currency' },
      { label: 'Subtotal', value: '@order.subtotalFetched#currency' },
      { label: 'URL de checkout', value: '@order.checkoutUrl#normalizeQuery' },
      { label: 'Frete', value: '@order.freightCost#currency' },
      { label: 'Desconto', value: '@order.discount#currency' },
    ],
  },
  {
    key: 'chat', label: 'Chat', items: [
      { label: 'ID do atendimento', value: '@chat.customerSupportRequestId' },
      { label: 'ID do chat', value: '@chat.chatId' },
      { label: 'Última mensagem', value: '@chat.lastMessage' },
      { label: 'Palavras-chave atuais', value: '@chat.currentKeyWords' },
    ],
  },
  { key: 'team', label: 'Time', value: '@team' },
  { key: 'flow', label: 'Flow', value: '@flow' },
]

/**
 * Resolve o que exibir para uma variável crua gravada. Bate com um item catalogado
 * (considerando o modificador final, quando há) e devolve o rótulo amigável
 * ("Categoria › Item" ou "Categoria › Item (Modificador)", resolved=true). Caso
 * contrário (prefixo completado / valor custom), devolve o cru (resolved=false).
 */
export function variableDisplay(value: string): { label: string; resolved: boolean } {
  for (const group of VARIABLE_GROUPS) {
    for (const item of group.items ?? []) {
      if (item.prefix) continue
      if (item.modifiers?.length) {
        for (const mod of item.modifiers) {
          if (item.value + mod.suffix === value) {
            const suffixLabel = mod.suffix ? ` (${mod.label})` : ''
            return { label: `${group.label} › ${item.label}${suffixLabel}`, resolved: true }
          }
        }
      } else if (item.value === value) {
        return { label: `${group.label} › ${item.label}`, resolved: true }
      }
    }
  }
  return { label: value, resolved: false }
}
