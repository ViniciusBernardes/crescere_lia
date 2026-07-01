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
import { isAiChatEnabled, transcribeAudio } from '../services/liaApi'
import { canUseMicrophone, getRecorderFormat } from '../utils/voiceRecorder'
import { stripHtml } from '../utils/html'
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
  audioNotice: boolean
  psychOpen: boolean
  mapBadge: boolean
  isRecording: boolean
  isTranscribing: boolean
  goToChat: () => void
  showScreen: (id: ScreenId) => void
  toggleAudio: () => void
  dismissAudioNotice: () => void
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile)
  const [progress, setProgress] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [audioNotice, setAudioNotice] = useState(false)
  const [psychOpen, setPsychOpen] = useState(false)
  const [mapBadge, setMapBadge] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const profileRef = useRef(profile)
  const pickerHandlers = useRef<Map<string, PickerHandler>>(new Map())
  const runnerRef = useRef<ReturnType<typeof createJourneyRunner> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderFormatRef = useRef<{ extension: string }>({ extension: 'webm' })
  const audioChunksRef = useRef<Blob[]>([])
  const messagesRef = useRef(messages)
  const typingSessionRef = useRef(0)
  const audioEnabledRef = useRef(audioEnabled)

  profileRef.current = profile
  messagesRef.current = messages
  audioEnabledRef.current = audioEnabled

  const { speak, listen, cancel, unlockAudio } = useSpeech(audioEnabled, isAiChatEnabled())

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
      isAudioEnabled: () => audioEnabledRef.current,
      getChatHistory: () =>
        messagesRef.current
          .filter((m): m is Extract<ChatMessage, { kind: 'user' | 'ai' }> => m.kind === 'user' || m.kind === 'ai')
          .slice(-20)
          .map((m) => ({
            role: (m.kind === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.kind === 'user' ? m.text : stripHtml(m.html),
          }))
          .filter((m) => m.content.length > 0),
      runWithTyping: (work, minDelay = 900) => {
        const session = ++typingSessionRef.current
        setMessages((prev) => [...prev.filter((m) => m.kind !== 'typing'), { id: uid(), kind: 'typing' }])
        const started = Date.now()
        Promise.resolve(work()).finally(() => {
          const remaining = Math.max(0, minDelay - (Date.now() - started))
          setTimeout(() => {
            if (typingSessionRef.current !== session) return
            setMessages((prev) => prev.filter((m) => m.kind !== 'typing'))
          }, remaining)
        })
      },
      addAiMsg: (html, audioText, extras, speechBlob) => {
        appendMessage({
          id: uid(),
          kind: 'ai',
          html,
          audioText,
          extras,
          time: formatTime(),
        })
        if (audioText) speak(audioText, speechBlob)
      },
      addUserMsg: (text) => {
        appendMessage({ id: uid(), kind: 'user', text, time: formatTime() })
      },
      showTyping: (cb, delay = 1600) => {
        const session = ++typingSessionRef.current
        setMessages((prev) => [...prev.filter((m) => m.kind !== 'typing'), { id: uid(), kind: 'typing' }])
        setTimeout(() => {
          if (typingSessionRef.current !== session) return
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
    void unlockAudio()
    setTimeout(() => runnerRef.current?.startIntroFlow(), 400)
  }, [unlockAudio])

  const toggleAudio = useCallback(() => {
    setAudioEnabled((v) => {
      const next = !v
      if (!next) {
        cancel()
      } else {
        void unlockAudio()
        setAudioNotice(false)
      }
      return next
    })
  }, [cancel, unlockAudio])

  const dismissAudioNotice = useCallback(() => setAudioNotice(false), [])

  const listenWithCheck = useCallback(
    (text: string) => {
      if (!audioEnabledRef.current) {
        setAudioNotice(true)
        return
      }
      listen(text)
    },
    [listen],
  )

  useEffect(() => {
    if (!audioNotice) return
    const timer = window.setTimeout(() => setAudioNotice(false), 6000)
    return () => window.clearTimeout(timer)
  }, [audioNotice])

  const openPsych = useCallback(() => setPsychOpen(true), [])
  const closePsych = useCallback(() => setPsychOpen(false), [])

  const sendMessage = useCallback((text: string) => {
    void unlockAudio()
    runnerRef.current?.sendMessage(text)
  }, [unlockAudio])

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
    if (isTranscribing) return

    if (!isRecording) {
      if (!canUseMicrophone()) {
        chatApi.addAiMsg(
          'Seu navegador não suporta gravação de áudio aqui. Escreva sua mensagem no campo de texto. 💙',
          'Seu navegador não suporta gravação de áudio aqui. Escreva sua mensagem no campo de texto.',
        )
        return
      }

      const format = getRecorderFormat()
      if (!format) {
        chatApi.addAiMsg(
          'Gravação de áudio não disponível neste dispositivo. Escreva sua mensagem no campo de texto. 💙',
          'Gravação de áudio não disponível neste dispositivo. Escreva sua mensagem no campo de texto.',
        )
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
        recorderFormatRef.current = format

        const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
        mediaRecorderRef.current = recorder
        audioChunksRef.current = []

        recorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        })

        recorder.addEventListener('stop', () => {
          stream.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          setIsRecording(false)

          const blob = new Blob(audioChunksRef.current, { type: format.mimeType })
          audioChunksRef.current = []

          if (blob.size < 800) {
            chatApi.addAiMsg(
              'Gravação muito curta. Segure o microfone um pouco mais e tente de novo. 💙',
              'Gravação muito curta. Segure o microfone um pouco mais e tente de novo.',
            )
            return
          }

          if (!isAiChatEnabled()) {
            chatApi.addUserMsg('🎙️ Mensagem de voz')
            chatApi.showTyping(
              () =>
                chatApi.addAiMsg(
                  'Recebi sua mensagem de voz! 💙 Pode também escrever se preferir.',
                  'Recebi sua mensagem de voz. Estou aqui para você.',
                ),
              1400,
            )
            return
          }

          setIsTranscribing(true)
          chatApi.runWithTyping(async () => {
            try {
              const text = await transcribeAudio(blob, `gravacao.${format.extension}`)
              const trimmed = text.trim()
              if (!trimmed) {
                chatApi.addAiMsg(
                  'Não consegui entender o áudio. Pode falar de novo ou escrever? 💙',
                  'Não consegui entender o áudio. Pode falar de novo ou escrever?',
                )
                return
              }
              runnerRef.current?.sendMessage(trimmed)
            } catch {
              chatApi.addAiMsg(
                'Não consegui transcrever o áudio. Verifique sua conexão e tente de novo. 💙',
                'Não consegui transcrever o áudio. Verifique sua conexão e tente de novo.',
              )
            } finally {
              setIsTranscribing(false)
            }
          })
        })

        recorder.start(250)
        setIsRecording(true)
      } catch {
        chatApi.addAiMsg(
          'Permita o acesso ao microfone nas configurações do navegador para enviar áudio. 💙',
          'Permita o acesso ao microfone nas configurações do navegador para enviar áudio.',
        )
      }
      return
    }

    mediaRecorderRef.current?.stop()
  }, [chatApi, isRecording, isTranscribing])

  const value: LiaContextValue = {
    screen,
    messages,
    profile,
    progress,
    audioEnabled,
    audioNotice,
    psychOpen,
    mapBadge,
    isRecording,
    isTranscribing,
    goToChat,
    showScreen,
    toggleAudio,
    dismissAudioNotice,
    openPsych,
    closePsych,
    sendMessage,
    toggleMic,
    pickEmotion,
    listen: listenWithCheck,
    startJourney,
  }

  return (
    <LiaContext.Provider value={value}>
      {children}
    </LiaContext.Provider>
  )
}

export function useLia() {
  const ctx = useContext(LiaContext)
  if (!ctx) throw new Error('useLia must be used within LiaProvider')
  return ctx
}
