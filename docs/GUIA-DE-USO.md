# Guia de uso — Fluxo Bot

Guia rápido do editor visual de fluxos de chatbot OmniChat. Atualizado para a **v0.12.1 + push CLI (Fase 4a)**.

> O ciclo completo: **importar (ou criar do zero) → editar no canvas → validar → exportar JSON → enviar para o rascunho do bot via CLI → publicar manualmente na plataforma**.

---

## 1. Abrir um fluxo

Clique em **Importar** na toolbar. O modal aceita duas entradas:

- **Colar JSON** — copie a resposta da requisição de intents na aba Network da plataforma e cole no textarea; `Ctrl+Enter` gera o fluxo.
- **Carregar arquivo** — selecione um `.json` exportado anteriormente.

Se já houver um fluxo com edições na tela, o modal avisa antes de substituir.

### Criar do zero

**Novo fluxo** (toolbar) pede o **botId** (UUID copiado da URL da plataforma) e cria a intenção de início canônica (`{botId}-start`). O JSON exportado já nasce com IDs reais do bot.

---

## 2. Navegar no canvas

- **Scroll** dá zoom; **arrastar** o fundo faz pan; o **minimapa** mostra a visão geral.
- Os botões **− espaço +** na toolbar ajustam o espaçamento do layout automático.
- Nós podem ser arrastados para reposicionar (apenas visual — não altera o JSON).

---

## 3. Editar o fluxo

### Criar nós

Arraste um tipo da paleta **Criar nó** (canto superior esquerdo) até a posição desejada. São 6 tipos: **Mensagem, Escolha, Captura, Transferência, Espera e Definir dados** — cada um nasce com o template canônico que a tela oficial usa (UUID novo, defaults corretos, caminho de erro apontando para o start).

### Conectar e reconectar

- **Conectar**: arraste do handle inferior de um nó até outro nó. Em nós de escolha, a conexão preenche o primeiro slot de botão vazio (a aresta nasce com o texto do botão como rótulo).
- **Reconectar**: arraste a **ponta de destino** (seta) de uma aresta para outra intenção. A origem não é móvel, e arestas para outros bots não são editáveis.
- **Deletar aresta**: selecione e pressione `Delete`. Em arestas de escolha, o slot fica vazio mas o botão é mantido (reconectável depois).

### Editar conteúdo

Clique num nó para abrir o painel à direita. Dá para editar **nome, categoria, keywords, mensagens (TEXT/BUTTON/LIST), texto e descrição dos botões, condições (nome, tipo, variável, valor), transferência, captura e variáveis do setData**. As mudanças ficam num rascunho local até clicar em **Aplicar alterações**.

- Adicionar botão cria um slot vazio de escolha — conecte no canvas para preenchê-lo.
- Remover botão remove a escolha na mesma posição (sincronia automática).
- Editar o texto de um botão atualiza o rótulo da aresta no canvas.

### Excluir intenções

Selecione o nó e pressione `Delete`, ou use o botão no painel. Todas as referências de entrada são limpas automaticamente (`next`, botão+escolha, `error.next`, fallbacks). O nó de início não é excluível.

### Desfazer / refazer

`Ctrl+Z` desfaz e `Ctrl+Shift+Z` (ou `Ctrl+Y`) refaz qualquer edição — também pelos botões **↶ ↷** na toolbar. Histórico de até 30 passos.

---

## 4. Validação

O **indicador na toolbar** recalcula a cada edição:

| Ícone | Significado |
|---|---|
| ✓ | Fluxo válido |
| ⚠ | Avisos (refs quebradas, fluxo sem start, botões dessincronizados) — não bloqueiam |
| ✕ | Erros (IDs duplicados, intenção sem nome/condições) — **bloqueiam o export JSON** |

Clique no indicador para ver a lista completa.

---

## 5. Exportar

O dropdown **Exportar** na toolbar oferece:

- **JSON** — fluxo completo no formato `{ "list": [...] }` aceito pela plataforma, preservando todos os campos não editados.
- **PNG / SVG** — imagem do fluxograma com dimensões calculadas pelos bounds reais dos nós.

---

## 6. Enviar para a plataforma (push CLI)

O push escreve **somente no rascunho** do bot — publicar continua sendo o botão manual na plataforma. Use apenas em bot de testes ou com certeza do alvo.

```powershell
$env:OMNI_TOKEN = 'r:...'        # token de sessão (nunca commitar)

# dry-run (padrão — não escreve nada):
node scripts/push-flow.mjs fluxo.json --bot <botId>

# executar de verdade:
node scripts/push-flow.mjs fluxo.json --bot <botId> --yes

# enviar uma única intenção:
node scripts/push-flow.mjs fluxo.json --bot <botId> --only <intentId> --yes
```

Por que duas passadas? A API **ignora IDs novos no POST e gera outros** — o script cria as intenções, captura os IDs reais e remapeia todas as referências (`next.intent`, `choices`, `error.next`, `fallbackIntents`) antes de reenviar. Validado ponta a ponta na plataforma real (ver [fase4-resultados.md](fase4-resultados.md)).

Guardrails embutidos: sem `--yes` é dry-run; `--bot` é obrigatório e conferido contra o botId do arquivo; backup automático do estado do servidor é salvo em `samples/` antes do primeiro POST; o push para no primeiro erro.

### Desfazer um push

```powershell
node scripts/rollback-bot.mjs <botId> samples/backup-<botId>-<timestamp>.json        # dry-run
node scripts/rollback-bot.mjs <botId> samples/backup-<botId>-<timestamp>.json --yes  # executar
```

---

## 7. Dark mode

Toggle sol/lua na toolbar — tema aplicado a toda a interface e salvo em `localStorage`.

---

## Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Ctrl+Enter` | Gerar fluxo (no modal de importação) |
| `Delete` / `Backspace` | Excluir nó ou aresta selecionada |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Refazer |

> Os atalhos de undo/redo são ignorados quando o foco está em campos de texto.
