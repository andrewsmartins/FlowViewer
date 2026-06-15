# Modelo de Intenção da OmniChat (Botmaker)

> **Spec de referência** para os tipos de nó do visualizador. Combina o que o
> usuário descreveu da tela de construção de intenções com os enums extraídos
> direto do bundle do construtor (`samples/OmniChat_files/omnichat-botmaker.js.download`).
> Cada tabela traz o **valor no JSON** (o que o visualizador lê/escreve) e o
> **rótulo exibido na plataforma** (o que o usuário vê).
>
> Fonte dos enums: módulos minificados do Botmaker (Angular). Última extração: 2026-06-15.

---

## 1. Anatomia de uma intenção

Uma **intenção** é o bloco da plataforma. Tem campos de cabeçalho (comuns a toda
intenção) e uma lista de **condições**. Cada condição carrega seu próprio gatilho,
mensagens, **uma ação** e o encadeamento para o próximo fluxo.

```
Intenção (bloco)
├─ Cabeçalho (comum):  Nome · Categoria · Prioridade · Contexto · Palavras-chave · Tempo de resposta
└─ Condições[]         (branches — avaliadas por prioridade; a que casar dispara)
    └─ Condição:  Nome · Tipo (gatilho) · Respostas (mensagens) · AÇÃO (1) · Próximo Fluxo · Fluxos Alternativos
```

Relação fundamental: **condição → ação é 1:1**. "Dividir os nós por tipo de ação"
equivale a **um nó por condição, tipado pela ação dela**.

---

## 2. Cabeçalho da intenção (campos comuns)

| Campo (UI) | Campo no JSON | Tipo / Observações |
|---|---|---|
| **Nome** | `name` | Texto livre. |
| **Categoria** | `category` | Texto livre — não é fixa. Serve para **agrupar** intenções; cria-se digitando e salvando. |
| **Prioridade** | `priority` | Enum fixo (ver §6). Desempata quando **duas intenções compartilham a mesma palavra-chave**: a de prioridade mais alta entra primeiro. |
| **Contexto** | `context` | Referência a **outra intenção existente**. A intenção só ativa se a conversa estiver **vindo da intenção setada no contexto**. |
| **Palavras-chave** | `keywords[]` | Atalhos que **direcionam direto** para esta intenção no fluxo. |
| **Tempo para envio da resposta** | `executionDelay` | Toggle ON/OFF + segundos. Quanto o bot espera, após a mensagem do cliente, para responder. |

---

## 3. Nível da condição

### 3.1 Nome da condição
`condition.name` — texto livre (ex.: "Condição Padrão", "Senão").

### 3.2 Tipo da condição (gatilho) — `condition.type`

Enum **`ConditionType`**:

| Valor JSON | Rótulo na plataforma |
|---|---|
| `any` | Sem nenhuma condição |
| `context` | O contexto é igual à |
| `lastIntent` | A última intenção foi |
| `empty` | O valor está vazio |
| `exists` | O valor existe |
| `equals` | O valor é igual à |
| `contains` | Valor contém |
| `totalIsGreaterThan` | Total é maior que |
| `totalIsEqual` | Total é igual à |
| `else` | Senão |

### 3.3 Respostas (Adicionar resposta) — `condition.assistant_says[].messages[].type`

Enum **`MessageType`** (subconjunto exposto como "Adicionar resposta"):

| Rótulo na plataforma | Valor JSON | Observações |
|---|---|---|
| Texto | `TEXT` | `content` = texto. |
| Imagem | `IMAGE` | mídia. |
| PDF | `DOCUMENT` / `FILE` | documento (PDF). |
| Vídeo | `VIDEO` | mídia. |
| Botão / Lista | `BUTTON` / `LIST` | usa `messageConfig` (header/body/footer + `buttons[]`). |
| Coleção | `COLLECTION` | catálogo/coleção de produtos. |
| Modelo de Mensagem com Flow | `TEMPLATE` | template com Flow (WhatsApp). |

> Enum completo do `MessageType` (para referência, nem todos viram "resposta"):
> `TEXT, IMAGE, AUDIO, VOICE, DOCUMENT, FILE, VIDEO, ROUTING, GROUPED, BUTTON,
> LIST, INTERACTIVE, SYSTEM, COLLECTION, SUMMARY, STICKER, REACTION, WHIZZ,
> WHIZZ_INACTIVITY, TEMPLATE`.

---

## 4. Ação — `condition.action.type`

Enum **`ActionType`** (11 tipos). É o que define o **tipo de nó** no visualizador.

| Valor JSON | Rótulo na plataforma | Campos relevantes da `action` |
|---|---|---|
| `none` | Sem ação | — (só mensagens / encadeamento) |
| `captureData` | Capturar informação | `captureDataType`, `captureDataTypesCategory`, `variable`, `multipleFields` |
| `choice` | Menu - Escolha de intenção | `choices[]` (IDs de intenção), botões em `messageConfig` |
| `setData` | Editar informação | `bulkUpdate[]` (`{variable, value}`) |
| `endConversation` | Terminar conversa | — |
| `store` | Ações sobre a loja física | `storeType` |
| `external` | Chamadas externas (API) | `external` (`{type, apiName}`) |
| `transfer` | Transferência de atendimento | `transferType`, `value` |
| `order` | Pedido | `orderType` |
| `captureCsat` | Captura CSAT | `captureDataType` = `supportRate` / `supportRateComment` |
| `waitForInteraction` | Aguardar interação | — (`next.redirect` = `waitInteraction`) |

### 4.1 Sub-enums das ações

**`CaptureDataType`** (tipo do dado capturado em `captureData`):

| Valor JSON | Rótulo |
|---|---|
| `fullName` | Nome Completo |
| `name` | Nome |
| `mail` | E-mail |
| `fullPhoneNumber` | Número de telefone |
| `cpf` | CPF |
| `cnpj` | CNPJ |
| `cpfOrCnpj` | CPF/CNPJ |
| `gender` | Gênero |
| `birthDate` | Data Nascimento |
| `zipcode` | CEP |
| `addressStreet` | Endereço - Rua |
| `addressNumber` | Endereço - Número |
| `addressComplement` | Endereço - Complemento |
| `entity` | Lista |
| `store` | Selecionar loja física |
| `custom` | Campo Customizado |
| `free` | Campo não mapeado (livre) |
| `consentLGPD` | Consentimento LGPD |
| `itemsToOrder` | Itens da coleção |
| `lastMessageText` | Texto da última mensagem |
| `captureFlow` | Respostas do Flow |
| `supportRate` | Dados avaliação CSAT - Nota |
| `supportRateComment` | Dados avaliação CSAT - Comentário |

**`TransferType`** (tipo de transferência em `transfer`):

| Valor JSON | Rótulo |
|---|---|
| `search4group` | Busca simples |
| `direct4group` | Busca avançada |
| `search4user` | (busca por usuário) |
| `direct4user` | (usuário direto) |
| `directFromBranch` | Pelo endereço físico selecionado |
| `direct4userPrevious` | Devolver atendimento para o vendedor |

**`OrderType`** (em `order`): `generateOrder` (gerar pedido) · `addToCart` (adicionar ao carrinho).

---

## 5. Encadeamento (saídas da condição)

### 5.1 Próximo Fluxo — `condition.next`

Define para onde a condição segue. Na UI: **"Neste bot"** ou **"Em outro bot"**.

| UI | JSON |
|---|---|
| Neste bot | `next.action = "intent"`, `next.intent = { botId, id }` (mesmo `botId`) |
| Em outro bot | `next.action = "bot"` (ou `botId` diferente) → no visualizador vira nó sintético **Outro Bot** |

`next.redirect` (enum **`RedirectType`**): `continueFlow` · `redirectAnswer` · `waitInteraction`.
`next.type` (enum **`NextIntentType`**): `all` · `context` · `fallback` · `error`.

### 5.2 Fluxos Alternativos — `condition.fallbackIntents[]`

Lista de IDs de **intenções já existentes** usadas como alternativa/fallback.

---

## 6. Prioridade — `priority`

Enum **`PriorityType`** (valor **numérico fracionário** no JSON):

| Valor JSON | Rótulo |
|---|---|
| `0` | Nenhuma |
| `0.25` | Baixa |
| `0.5` | Média |
| `0.75` | Alta |
| `1` | Muita Alta |

---

## 7. Resumo: ActionType ↔ tipo de nó do visualizador

| `action.type` | NodeKind (visualizador) | Status |
|---|---|---|
| `none` | `messageNode` (default atual) | existente |
| `choice` | `choiceNode` | existente |
| `captureData` | `captureNode` | existente |
| `setData` | `setDataNode` | existente |
| `transfer` | `transferNode` | existente |
| `waitForInteraction` | `waitNode` | existente |
| `endConversation` | `endNode` | **a criar** |
| `external` | `apiCallNode` (≠ `externalBotNode`) | **a criar** |
| `order` | `orderNode` | **a criar** |
| `captureCsat` | `csatNode` | **a criar** |
| `store` | `storeNode` | **a criar** |

> `externalBotNode` (existente) = redirecionamento para **outro bot** (`next.action="bot"`).
> Não confundir com `action.type="external"` (chamada de **API**).
</content>
</invoke>
