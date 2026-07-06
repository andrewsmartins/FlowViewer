/**
 * Limites de caractere dos campos de uma mensagem Botão/Lista (menu). Fonte ÚNICA
 * compartilhada pelo hard-block do `buildButtonList` (agente + UI), pelo nudge do
 * `validate()` (menus legados/importados) e pelo `maxLength` dos inputs do DetailPanel.
 *
 * Valores = os do builder REAL da OmniChat (observados na plataforma), NÃO o WhatsApp
 * cru: a OmniChat "em geral" segue o WhatsApp Business API, mas desvia em alguns campos
 * (o body do WhatsApp é 1024; o builder OmniChat usa 80). O que a plataforma de fato
 * rejeita é o que vale aqui. Item = 20 FIXO (BUTTON e LIST) — não varia por tipo.
 */
export const MENU_LIMITS = {
  header: 60,
  body: 80,
  footer: 60,
  title: 20,
  item: 20,
  description: 72,
} as const

/** Campos normalizados de um menu, para checar contra `MENU_LIMITS`. */
export interface MenuLimitFields {
  header: string
  title: string
  body: string
  footer: string
  items: { text: string; description: string }[]
}

/**
 * Retorna as violações de limite de caractere de um menu (array vazio = tudo dentro).
 * Cada string é legível ("item 2 excede 20 caracteres (tem 23)"). O `buildButtonList`
 * usa a 1ª como erro de hard-block; o `validate()` coleta todas num nudge não-bloqueante.
 * Recebe os campos JÁ normalizados (em BUTTON o `title` chega vazio e não falso-positiva).
 */
export function findMenuLimitViolations(fields: MenuLimitFields): string[] {
  const violations: string[] = []
  const check = (label: string, value: string, max: number) => {
    if (value.length > max) violations.push(`${label} excede ${max} caracteres (tem ${value.length})`)
  }
  check('cabeçalho', fields.header, MENU_LIMITS.header)
  check('corpo do texto', fields.body, MENU_LIMITS.body)
  check('rodapé', fields.footer, MENU_LIMITS.footer)
  check('título do menu', fields.title, MENU_LIMITS.title)
  fields.items.forEach((it, i) => {
    check(`item ${i + 1}`, it.text, MENU_LIMITS.item)
    check(`descrição do item ${i + 1}`, it.description, MENU_LIMITS.description)
  })
  return violations
}
