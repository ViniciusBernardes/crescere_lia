import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createJourneyRunner } from '../flows/journeyFlows'
import { useSpeech } from '../hooks/useSpeech'
import { formatTime, uid } from '../utils/time'
import type { ChatApi, ChatMessage, ScreenId } from '../types/chat'
import { createEmptyProfile, type UserProfile } from '../types/profile'

interface PickerHandler {
  onPick: (idx: number, label: string) => void
}

interface LiaContextValue {
  screen: ScreenId
  messages: ChatMessage[]
  profile: UserProfile
  progress: number
  audioEnabled: boolean
  psychOpen: boolean
  mapBadge: boolean
  isRecording: boolean
  goToChat: () => void
  showScreen: (id: ScreenId) => void
  toggleAudio: () => void
  openPsych: () => void
  closePsych: () => void
  sendMessage: (text: string) => void
  toggleMic: () => void
  pickEmotion: (pickerId: string, idx: number, label: string) => void
  listen: (text: string) => void
  startJourney: (n: number) => void
}

const LiaContext = createContext<LiaContextValue | null>(null)

const screenMap: Record<string, ScreenId> = {
  introScreen: 'intro',
  chatScreen: 'chat',
  journeyScreen: 'journey',
  mapScreen: 'map',
}

export function LiaProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>('intro')
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: uid(), kind: 'ai', html: '', time: '' }])
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile)
  const [progress, setProgress] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [psychOpen, setPsychOpen] = useState(false)
  const [mapBadge, setMapBadge] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const profileRef = useRef(profile)
  const pickerHandlers = useRef<Map<string, PickerHandler>>(new Map())
  const runnerRef = useRef<ReturnType<typeof createJourneyRunner> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  profileRef.current = profile

  const { speak, cancel } = useSpeech(audioEnabled)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const withoutTyping = prev.filter((m) => m.kind !== 'typing')
      return [...withoutTyping, msg]
    })
  }, [])

  const showScreen = useCallback((id: ScreenId) => {
    setScreen(id)
  }, [])

  const chatApi = useMemo<ChatApi>(
    () => ({
      getProfile: () => profileRef.current,
      addAiMsg: (html, audioText, extras) => {
        appendMessage({
          id: uid(),
          kind: 'ai',
          html,
          audioText,
          extras,
          time: formatTime(),
        })
        if (audioText) speak(audioText)
      },
      addUserMsg: (text) => {
        appendMessage({ id: uid(), kind: 'user', text, time: formatTime() })
      },
      showTyping: (cb, delay = 1600) => {
        setMessages((prev) => [...prev.filter((m) => m.kind !== 'typing'), { id: uid(), kind: 'typing' }])
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.kind !== 'typing'))
          cb()
        }, delay)
      },
      addPicker: (question, audioQ, pills, onPick) => {
        const pickerId = uid()
        pickerHandlers.current.set(pickerId, { onPick })
        appendMessage({
          id: uid(),
          kind: 'picker',
          question,
          audioQ,
          pills,
          time: formatTime(),
          pickerId,
        })
        if (audioQ) speak(audioQ)
      },
      addCtas: (buttons) => {
        appendMessage({ id: uid(), kind: 'ctas', buttons, time: formatTime() })
      },
      suggestBlock: (journey) => {
        appendMessage({ id: uid(), kind: 'suggest', journey, time: formatTime() })
        speak(
          'Com base em como você está, sugiro começar por essa jornada. E lembre-se que o plantão psicológico está sempre disponível.',
        )
      },
      updateMap: () => {
        setMapBadge(true)
        setProfile({ ...profileRef.current })
      },
      setProgress: (pct) => setProgress(pct),
      showScreen: (legacyId) => {
        const mapped = screenMap[legacyId] ?? (legacyId as ScreenId)
        setScreen(mapped)
      },
      openPsych: () => setPsychOpen(true),
      startJourney: (n) => {
        runnerRef.current?.startJourney(n)
      },
      speak,
    }),
    [appendMessage, speak],
  )

  useEffect(() => {
    runnerRef.current = createJourneyRunner(chatApi)
  }, [chatApi])

  const goToChat = useCallback(() => {
    setScreen('chat')
    setMessages([])
    setTimeout(() => runnerRef.current?.startIntroFlow(), 400)
  }, [])

  const toggleAudio = useCallback(() => {
    setAudioEnabled((v) => {
      if (v) cancel()
      return !v
    })
  }, [cancel])

  const openPsych = useCallback(() => setPsychOpen(true), [])
  const closePsych = useCallback(() => setPsychOpen(false), [])

  const sendMessage = useCallback((text: string) => {
    runnerRef.current?.sendMessage(text)
  }, [])

  const startJourney = useCallback((n: number) => {
    setScreen('chat')
    runnerRef.current?.startJourney(n)
  }, [])

  const pickEmotion = useCallback(
    (pickerId: string, idx: number, label: string) => {
      const handler = pickerHandlers.current.get(pickerId)
      if (!handler) return
      pickerHandlers.current.delete(pickerId)
      appendMessage({ id: uid(), kind: 'user', text: label, time: formatTime() })
      handler.onPick(idx, label)
    },
    [appendMessage],
  )

  const toggleMic = useCallback(async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        recorder.start()
        setIsRecording(true)
        recorder.addEventListener('stop', () => {
          stream.getTracks().forEach((t) => t.stop())
          setIsRecording(false)
          chatApi.addUserMsg('🎙️ Mensagem de voz')
          chatApi.showTyping(
            () =>
              chatApi.addAiMsg(
                'Recebi sua mensagem de voz! 💙 Pode também escrever se preferir.',
                'Recebi sua mensagem de voz. Estou aqui para você.',
              ),
            1400,
          )
        })
      } catch {
        alert('Permita acesso ao microfone.')
      }
    } else {
      mediaRecorderRef.current?.stop()
    }
  }, [chatApi, isRecording])

  const value: LiaContextValue = {
    screen,
    messages,
    profile,
    progress,
    audioEnabled,
    psychOpen,
    mapBadge,
    isRecording,
    goToChat,
    showScreen,
    toggleAudio,
    openPsych,
    closePsych,
    sendMessage,
    toggleMic,
    pickEmotion,
    listen: speak,
    startJourney,
  }

  return (
    <LiaContext.Provider value={value}>
      {children}
      <div ref={messagesEndRef} style={{ height: 0 }} aria-hidden />
    </LiaContext.Provider>
  )
}

export function useLia() {
  const ctx = useContext(LiaContext)
  if (!ctx) throw new Error('useLia must be used within LiaProvider')
  return ctx
}
