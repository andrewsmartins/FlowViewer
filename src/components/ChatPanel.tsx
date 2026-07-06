import { useState, useRef, useEffect, useLayoutEffect, type FormEvent, type KeyboardEvent, type ChangeEvent, type CSSProperties } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useChatSocket, type ChatMessage, type ConnStatus } from '../hooks/useChatSocket'
import { useClickOutside } from '../hooks/useClickOutside'
import { useDraggable } from '../hooks/useDraggable'
import { useResizable, type Size } from '../hooks/useResizable'
import { chatGatePending, type ChatGateRequirement } from '../utils/chatGate'
import type { BotFlowJson } from '../types'

/**
 * Caixinha de chat do agente construtor (PoC local, passo 4 — PLANS §
 * "Caixinha de chat"). Widget flutuante ancorado no canto SUPERIOR direito
 * (redesign do widget, decisão 1): overlay sobre o canvas, sem mexer no layout.
 * Só renderizada no dev build (o App a monta sob `import.meta.env.DEV`), pois
 * depende do backend local.
 *
 * Abre com EXPANSÃO ANIMADA (redesign do widget, decisão 5): um wrapper único
 * transiciona `width`/`height` entre o footprint da pill e o tamanho do painel
 * (~320ms ease-out, `overflow-hidden` durante a animação), enquanto as duas
 * camadas (pill × painel) fazem cross-fade. A âncora no topo-direito faz a janela
 * crescer p/ a esquerda e p/ baixo (decisão 2). Respeita `prefers-reduced-motion`.
 *
 * A janela é REDIMENSIONÁVEL (redesign do widget, decisão 6): a alça no canto
 * inferior-esquerdo arrasta via `useResizable` mantendo o canto superior-direito
 * fixo — cresce livre da mín (`computePanelSize`, o default) até a viewport. O
 * tamanho vive só em memória (decisão 7); recarregar volta ao default.
 *
 * Encapsula o `useChatSocket` (uma sessão do Agent SDK por chat). Ao ENVIAR,
 * serializa o canvas atual via `getFlow` e manda no flush (decisão 5); o turno
 * trava a UI (`onRunningChange` propaga o lock pro canvas). Ao fim, o
 * `onFlowUpdated` (já no App) re-renderiza o canvas com guard de parse.
 */

interface ChatPanelProps {
  /** Serializa o canvas atual para o flush (decisão 5). Null = sem fluxo carregado. */
  getFlow: () => string | null
  /** Recebe o fluxo novo ao fim do turno (decisão 3) — App faz parseFlow + guard. */
  onFlowUpdated: (flow: BotFlowJson) => void
  /** Propaga o estado do turno para o App travar/destravar o canvas. */
  onRunningChange: (running: boolean) => void
  /**
   * Sinais ABSTRATOS do gate (PLANS §"Gate de acesso à caixinha", decisão 2): a
   * caixinha só abre com `hasFlow && hasToken`. O painel não sabe de onde vêm —
   * hoje do front (dev), na Fase 5 da OmniChat. Derivados no `useChatGate` do App.
   */
  hasFlow: boolean
  hasToken: boolean
  /** CTA do popover quando falta fluxo (decisão 4) — abre o importador. */
  onRequestImport: () => void
  /** CTA do popover quando falta token (decisão 4) — abre o popover da chave na barra. */
  onRequestToken: () => void
}

/**
 * Textos do popover do gate por requisito pendente (decisão 4). Tom de DEV
 * ("você esqueceu de inserir"); na Fase 5 vira "a OmniChat não passou esse dado"
 * (detector de bug de integração) — trocar aqui quando o gate sair do dev-only.
 */
const GATE_REQUIREMENT: Record<ChatGateRequirement, { title: string; cta: string }> = {
  flow:  { title: 'Nenhum fluxo carregado', cta: 'Carregar um fluxo' },
  token: { title: 'Token de sessão não inserido', cta: 'Inserir o token' },
}

const STATUS_DOT: Record<ConnStatus, string> = {
  connecting: 'bg-amber-400',
  open:       'bg-emerald-400',
  closed:     'bg-rose-500',
}

const STATUS_LABEL: Record<ConnStatus, string> = {
  connecting: 'Conectando…',
  open:       'Conectado',
  closed:     'Offline — rode `npm run ws:dev`',
}

/**
 * Máquina de estados da expansão (redesign do widget, decisão 5). `opening`/
 * `closing` são os estados transitórios em que o wrapper anima width/height e
 * recorta o overflow; `closed`/`open` são os repousos.
 */
type WidgetPhase = 'closed' | 'opening' | 'open' | 'closing'

/** Duração da expansão (decisão 5) e do cross-fade das camadas, em ms. */
const EXPAND_MS = 320
const FADE_MS = 200

/**
 * Tamanho-alvo do painel aberto, clampado à viewport (equivale ao antigo
 * `w-[400px] max-w-[92vw] h-[600px] max-h-[80vh]`). É a base do resize da
 * decisão 6 — vive em estado, e também é o **piso** do redimensionamento
 * (mín = default): resize só cresce, nunca encolhe abaixo daqui.
 */
function computePanelSize(): Size {
  return {
    w: Math.min(400, Math.round(window.innerWidth * 0.92)),
    h: Math.min(600, Math.round(window.innerHeight * 0.80)),
  }
}

/** Lê o prefers-reduced-motion (encurta a expansão e o cross-fade — decisão 5). */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ChatPanel({ getFlow, onFlowUpdated, onRunningChange, hasFlow, hasToken, onRequestImport, onRequestToken }: ChatPanelProps) {
  const isDark = useTheme()
  const [phase, setPhase] = useState<WidgetPhase>('closed')
  const [gateOpen, setGateOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pillSize, setPillSize] = useState<Size | null>(null)
  const [panelSize, setPanelSize] = useState<Size>(computePanelSize)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const { status, messages, running, statusText, send } = useChatSocket({ onFlowUpdated })
  const scrollRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const launcherRef  = useRef<HTMLButtonElement>(null)
  const animTimer    = useRef<ReturnType<typeof setTimeout>>()
  const gateRef      = useClickOutside<HTMLDivElement>(() => setGateOpen(false))
  const { ref: dragRef, pos, setPos, style: dragStyle, onMouseDown: onDragMouseDown, wasDragged } = useDraggable<HTMLDivElement>()

  // Resize pela alça inferior-esquerda (decisão 6): grava o tamanho novo e, SÓ no
  // modo arrastado (`pos != null`, posicionado por left/top), recua o `left` p/
  // manter o canto superior-direito fixo. No modo ancorado-por-CSS (`right-4`) a
  // borda direita já é fixa — não toca na posição. O piso é o default (`computePanelSize`).
  const { onMouseDown: onResizeMouseDown, resizing } = useResizable<HTMLDivElement>(
    dragRef,
    computePanelSize(),
    (size, anchor) => {
      setPanelSize(size)
      if (pos) setPos({ x: anchor.rightX - size.w, y: anchor.topY })
    },
  )

  // Gate só na abertura (decisão 5 do gate): avaliado no clique; uma vez dentro, segue.
  const pending = chatGatePending(hasFlow, hasToken)
  const blocked = pending.length > 0

  // ── Máquina de estados da expansão (decisão 5) ─────────────────────────────
  // `collapsed` = os dois extremos "pequenos" (fechado e fechando) — define o
  // alvo de tamanho e qual camada aparece no cross-fade.
  const collapsed = phase === 'closed' || phase === 'closing'
  // Antes da 1ª medição da pill o wrapper fica `auto` (a pill em fluxo o dimensiona);
  // depois passa a px explícito p/ que a transição de width/height funcione.
  const boxSize = pillSize == null ? undefined : (collapsed ? pillSize : panelSize)
  // overflow-hidden só DURANTE a animação (recorta o painel sendo revelado); nos
  // repousos volta a `visible` p/ não cortar a sombra dos cartões nem o popover do gate.
  const clipping = phase === 'opening' || phase === 'closing'
  const sizeDur = reduced ? '0ms' : `${EXPAND_MS}ms`
  const fadeDur = reduced ? '0ms' : `${FADE_MS}ms`

  function openPanel() {
    clearTimeout(animTimer.current)
    if (reduced) { setPhase('open'); return }   // sem animação: pula direto
    setPhase('opening')
    animTimer.current = setTimeout(() => setPhase('open'), EXPAND_MS)
  }

  function collapsePanel() {
    clearTimeout(animTimer.current)
    if (reduced) { setPhase('closed'); return }
    setPhase('closing')
    animTimer.current = setTimeout(() => setPhase('closed'), EXPAND_MS)
  }

  function handleLauncherClick() {
    if (wasDragged()) return  // clique suprimido quando encerra um drag
    if (blocked) { setGateOpen(o => !o); return }
    openPanel()
  }

  function handleGateCta(req: ChatGateRequirement) {
    setGateOpen(false)
    if (req === 'flow') onRequestImport()
    else onRequestToken()
  }

  // Mede o footprint real da pill p/ ancorar a animação de width/height (decisão 5).
  // Só quando recolhido (a pill é a camada visível em tamanho natural); re-mede se o
  // conteúdo mudar (cadeado ↔ ondas, acento `running`), mantendo o alvo "fechado" fiel.
  useLayoutEffect(() => {
    const el = launcherRef.current
    if (!el || !collapsed) return
    const w = Math.ceil(el.offsetWidth)
    const h = Math.ceil(el.offsetHeight)
    setPillSize(prev => (prev && prev.w === w && prev.h === h) ? prev : { w, h })
  }, [collapsed, blocked, running])

  // Acompanha prefers-reduced-motion ao vivo (encurta expansão + cross-fade — decisão 5).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Reclampa o painel quando a viewport muda (base do resize da decisão 6).
  useEffect(() => {
    const onResize = () => setPanelSize(computePanelSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Limpa o timer da máquina de estados ao desmontar (evita setState órfão).
  useEffect(() => () => clearTimeout(animTimer.current), [])

  // Propaga o lock do turno para o App (canvas read-only durante o turno).
  useEffect(() => { onRunningChange(running) }, [running, onRunningChange])

  // Auto-scroll para a última mensagem a cada novo conteúdo.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, statusText])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || running || status !== 'open') return
    send(text, getFlow())
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize: min 1 linha → cresce até 5 linhas (~120px) → rola (decisão 6).
  function handleDraftChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  // Wrapper externo único: dono da posição (drag), do tamanho animado (decisão 5)
  // e do clip da expansão. Ancorado no topo-direito por padrão (decisão 1) — a
  // janela cresce p/ a esquerda e p/ baixo (decisão 2). As duas camadas abaixo
  // (pill × painel) fazem cross-fade dentro dele.
  return (
    <div
      ref={dragRef}
      className={`fixed z-30 rounded-2xl${dragStyle ? '' : ' top-4 right-4'}`}
      style={{
        ...dragStyle,
        width: boxSize?.w,
        height: boxSize?.h,
        overflow: clipping ? 'hidden' : 'visible',
        // Sem transição durante o resize: a alça deve seguir o cursor em tempo real
        // (a transição de 320ms da expansão criaria rubber-band no arraste).
        transition: resizing ? 'none' : `width ${sizeDur} ease-out, height ${sizeDur} ease-out`,
      }}
    >
      {/* ── Camada recolhida (pill) ─────────────────────────────────────────
          Antes da 1ª medição fica em fluxo (dimensiona o wrapper `auto`); depois
          ancora no topo-direito p/ acompanhar o canto fixo durante a animação. */}
      <div
        ref={gateRef}
        className={pillSize == null ? '' : 'absolute top-0 right-0'}
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: phase === 'closed' ? 'auto' : 'none',
          transition: `opacity ${fadeDur} ease-out`,
        }}
      >
        {/* Popover do gate (decisões 3 e 4): abre p/ BAIXO agora que a âncora é o
            topo (decisão 1). Só os requisitos pendentes, cada um com seu CTA. */}
        {gateOpen && blocked && (
          <div
            role="dialog"
            aria-label="Requisitos para usar o agente"
            className={`absolute top-full right-0 mt-2 w-[280px] rounded-xl border shadow-2xl p-3 flex flex-col gap-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
          >
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              Para abrir o agente, falta:
            </p>
            {pending.map(req => (
              <div key={req} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{GATE_REQUIREMENT[req].title}</span>
                <button
                  onClick={() => handleGateCta(req)}
                  className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  {GATE_REQUIREMENT[req].cta}
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Botão minimizado: retangular arredondado + cor do menu (zinc-950, sempre
            escura, independente do tema — como o rail), acento amber quando running
            (redesign do widget, decisão 3). onMouseDown inicia drag; onClick abre/trava
            (suprimido após drag). `launcherRef` mede o footprint p/ a animação. */}
        <button
          ref={launcherRef}
          onMouseDown={onDragMouseDown}
          onClick={handleLauncherClick}
          aria-label={blocked ? 'Agente indisponível — requisitos pendentes' : 'Abrir o agente construtor'}
          aria-expanded={blocked ? gateOpen : undefined}
          className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg border transition-colors cursor-grab active:cursor-grabbing bg-zinc-950 text-zinc-100 hover:bg-zinc-800 ${running && status === 'open' ? 'border-amber-400' : 'border-zinc-800'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Agente
          {blocked ? (
            // Cadeado quando bloqueado (decisão 4): comunica "indisponível" antes do clique;
            // as ondas só aparecem quando desbloqueado.
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <StatusWaves status={status} running={running} />
          )}
        </button>
      </div>

      {/* ── Camada expandida (painel) ───────────────────────────────────────
          Sobreposta, ancorada no topo-direito e dimensionada ao tamanho FINAL:
          a animação do wrapper a revela progressivamente. `visibility:hidden`
          quando totalmente fechado a tira do hit-testing e do foco por tab. */}
      <div
        className="absolute top-0 right-0"
        style={{
          width: panelSize.w,
          height: panelSize.h,
          opacity: collapsed ? 0 : 1,
          visibility: phase === 'closed' ? 'hidden' : 'visible',
          pointerEvents: phase === 'open' ? 'auto' : 'none',
          transition: `opacity ${fadeDur} ease-out`,
        }}
        aria-hidden={phase !== 'open'}
      >
        <div
          className={`relative flex flex-col w-full h-full rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
          role="dialog"
          aria-label="Agente construtor de fluxo"
        >
          {/* Header — handle de drag (não inicia em botões descendentes). */}
          <div
            onMouseDown={e => { if (!(e.target as HTMLElement).closest('button')) onDragMouseDown(e) }}
            style={{ cursor: 'grab' }}
            className={`flex items-center gap-2 px-4 py-3 border-b select-none ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status]} ${running ? 'animate-pulse' : ''}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Agente construtor</p>
              <p className={`text-[11px] leading-tight truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {running && statusText ? statusText : STATUS_LABEL[status]}
              </p>
            </div>
            <button
              onClick={collapsePanel}
              aria-label="Recolher o agente"
              className={isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
            {messages.length === 0 && (
              <p className={`m-auto max-w-[260px] text-center text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Instrua o agente em linguagem natural — ex.: <em>"crie um nó de mensagem chamado boas_vindas e conecte ao início"</em>. As mudanças aparecem no canvas ao fim de cada turno.
              </p>
            )}
            {messages.map(m => <Bubble key={m.id} msg={m} isDark={isDark} />)}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className={`flex items-end gap-2 p-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handleKeyDown}
              placeholder={status === 'open' ? 'Instrua o agente…' : 'Aguardando o backend…'}
              rows={1}
              disabled={running || status !== 'open'}
              spellCheck={false}
              className={`flex-1 resize-none rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors overflow-y-auto max-h-[120px] disabled:opacity-50 ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700 placeholder:text-slate-600' : 'bg-slate-50 text-slate-900 border-slate-200 placeholder:text-slate-400'}`}
            />
            <button
              type="submit"
              disabled={running || status !== 'open' || !draft.trim()}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {running ? '…' : 'Enviar'}
            </button>
          </form>

          {/* Alça de resize (decisão 6): canto inferior-esquerdo, mantém o canto
              superior-direito fixo. Herda o pointerEvents da camada do painel — só
              é interativa quando `phase === 'open'`. Grip diagonal (nesw). */}
          <div
            onMouseDown={onResizeMouseDown}
            role="separator"
            aria-label="Redimensionar o agente"
            title="Arraste para redimensionar"
            className={`absolute bottom-0 left-0 h-5 w-5 cursor-nesw-resize ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="absolute bottom-1 left-1 h-3 w-3">
              <line x1="1" y1="15" x2="15" y2="1" />
              <line x1="1" y1="9" x2="9" y2="1" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Ícone de ondas sonoras (3 barras verticais animadas) no botão minimizado do
 * agente (redesign do widget, decisão 4). Substitui o antigo ponto de status:
 * a COR reflete o estado da conexão WS (reusa `STATUS_DOT` — verde/âmbar/vermelho)
 * e a animação fica mais rápida no `running` (`--wave-duration`), "respirando"
 * devagar quando ocioso. `prefers-reduced-motion` deixa as barras estáticas (CSS
 * em index.css). Puramente decorativo → `aria-hidden`; o estado textual da conexão
 * vive no header do painel aberto (`STATUS_LABEL`). */
function StatusWaves({ status, running }: { status: ConnStatus; running: boolean }) {
  const barColor = STATUS_DOT[status]
  const duration = running && status === 'open' ? '0.6s' : '1.4s'
  return (
    <span
      className="flex items-center gap-[2px] h-3.5"
      style={{ '--wave-duration': duration } as CSSProperties}
      aria-hidden="true"
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`fluxo-wave-bar w-[3px] h-full rounded-full ${barColor}`}
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  )
}

/** Uma bolha do chat — estilo por papel (usuário/agente/tool/fluxo/erro). */
function Bubble({ msg, isDark }: { msg: ChatMessage; isDark: boolean }) {
  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 text-white text-sm px-3 py-2 whitespace-pre-wrap break-words">
        {msg.text}
      </div>
    )
  }
  if (msg.role === 'tool') {
    return (
      <div className={`self-start max-w-[90%] rounded-lg px-3 py-1.5 font-mono text-[11px] break-words ${isDark ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-900' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
        <span className="font-bold">{msg.toolName}</span>
        <span className="opacity-70">({msg.toolInput})</span>
      </div>
    )
  }
  if (msg.role === 'flow') {
    return (
      <div className={`self-start max-w-[90%] rounded-lg px-3 py-1.5 text-[11px] font-medium ${isDark ? 'bg-blue-950/60 text-blue-300 border border-blue-900' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
        ✓ {msg.text}
      </div>
    )
  }
  if (msg.role === 'error') {
    return (
      <div className={`self-start max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${isDark ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
        <strong>Erro:</strong> {msg.text}
      </div>
    )
  }
  // assistant
  return (
    <div className={`self-start max-w-[85%] rounded-2xl rounded-bl-sm text-sm px-3 py-2 whitespace-pre-wrap break-words ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
      {msg.text}
    </div>
  )
}
