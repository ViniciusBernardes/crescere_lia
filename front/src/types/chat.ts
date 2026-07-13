import type { UserProfile } from './profile'

export type ScreenId = 'intro' | 'chat' | 'journey' | 'map'

export interface PillOption {
  emoji?: string
  label: string
}

export type CtaStyle = 'primary' | 'secondary' | 'accent'

export interface CtaButton {
  icon: string
  label: string
  sub?: string
  style?: CtaStyle
  action: () => void
}

export interface JourneyQuestion {
  id?: number
  sort_order: number
  type: 'open' | 'multiple_choice'
  prompt: string
  options?: string[]
}

export interface JourneyItem {
  n: number
  icon: string
  title: string
  sub: string
  color: string
  questions?: JourneyQuestion[]
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatApi {
  getProfile: () => UserProfile
  getChatHistory: () => ChatHistoryEntry[]
  isAudioEnabled: () => boolean
  runWithTyping: (work: () => void | Promise<void>, minDelay?: number) => void
  addAiMsg: (html: string, audioText?: string, extras?: string, speechBlob?: Blob) => void
  addUserMsg: (text: string) => void
  showTyping: (cb: () => void, delay?: number) => void
  addPicker: (
    question: string,
    audioQ: string,
    pills: PillOption[],
    onPick: (idx: number, label: string) => void,
    options?: { forcePills?: boolean },
  ) => void
  addCtas: (buttons: CtaButton[]) => void
  suggestBlock: (journey: JourneyItem) => void
  updateMap: () => void
  setProgress: (pct: number) => void
  showScreen: (id: ScreenId | string) => void
  openPsych: () => void
  startJourney: (n: number) => void
  speak: (text: string, preloaded?: Blob) => void
}

export type AiMessage = {
  id: string
  kind: 'ai'
  html: string
  audioText?: string
  extras?: string
  time: string
}

export type UserMessage = {
  id: string
  kind: 'user'
  text: string
  time: string
}

export type TypingMessage = {
  id: string
  kind: 'typing'
}

export type PickerMessage = {
  id: string
  kind: 'picker'
  question: string
  audioQ?: string
  pills: PillOption[]
  time: string
  pickerId: string
}

export type CtasMessage = {
  id: string
  kind: 'ctas'
  buttons: CtaButton[]
  time: string
}

export type SuggestMessage = {
  id: string
  kind: 'suggest'
  journey: JourneyItem
  time: string
}

export type ChatMessage =
  | AiMessage
  | UserMessage
  | TypingMessage
  | PickerMessage
  | CtasMessage
  | SuggestMessage
