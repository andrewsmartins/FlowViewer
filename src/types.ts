export interface BotFlowJson {
  list: BotIntent[]
}

export interface BotIntent {
  id: string
  name: string
  category: string
  botId: string
  keywords: string[]
  context: string | null
  priority: number
  conditions: Condition[]
  createdAt?: string
  updatedAt?: string
}

export interface Condition {
  name: string
  type: string
  variable: string | null
  intent: string | null
  value: string | null
  valueNumber: number | null
  fallbackIntents: string[]
  values: unknown
  context: unknown
  action: Action
  assistant_says: AssistantSay[]
  next: Next
}

export interface Action {
  type: string
  choices: string[] | null
  captureDataType: string | null
  transferType: string | null
  value: string | null
  variable: string | null
  conversationType: string | null
  orderType?: string | null
  storeType: string | null
  entity: unknown
  bulkUpdate?: unknown[]
  external?: { type: unknown; apiName: unknown }
  error?: ErrorAction
}

export interface ErrorAction {
  next: Next
  assistant_says: AssistantSay[]
}

export interface Next {
  type: string
  redirect?: string
  action?: string
  intent?: { botId: string; id: string } | string
  intentBot?: string
}

export interface AssistantSay {
  channel: string
  messages: BotMessage[]
}

export interface BotMessage {
  type: string
  content?: string | null
  messageConfig?: ButtonMessageConfig
}

export interface ButtonMessageConfig {
  header: string | null
  title: string | null
  body: string | null
  footer: string | null
  type: string
  buttons: ButtonOption[]
}

export interface ButtonOption {
  id: string
  text: string
  description: string | null
}

export type NodeKind = 'startNode' | 'choiceNode' | 'captureNode' | 'transferNode' | 'defaultNode'

export interface FlowNodeData extends Record<string, unknown> {
  name: string
  category: string
  messagePreview: string
  buttons: ButtonOption[]
  actionType: string
  captureDataType: string | null
  transferType: string | null
}
