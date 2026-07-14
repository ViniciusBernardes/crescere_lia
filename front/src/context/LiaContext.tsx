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
import { ensureJourneysLoaded } from '../data/journeys'
import { showEmotionalMap, showJourneys, showQuickReplies } from '../lib/features'
import { isMoodQuestion, OPEN_MOOD_PROMPT, OPEN_REPLY_HINT } from '../lib/openPrompts'
import { syncCaregiverProfile } from '../services/sessionSync'
import { useSpeech, type SpeechPlayback } from '../hooks/useSpeech'
import { isAiChatEnabled, fetchChatSettings, fetchJourneys, transcribeAudio } from '../services/liaApi'
import { canUseMicrophone, createMediaRecorder, getRecorderFormat, micErrorMessage } from '../utils/voiceRecorder'
import { stripHtml } from '../utils/html'
import type { SpeechRate } from '../utils/speechRate'
import { formatTime, uid } from '../utils/time'
import type { ChatApi, ChatMessage, ScreenId } from '../types/chat'
import { createEmptyProfile, type UserProfile } from '../types/profile'

interface PickerHandler {
  onPick: (idx: number, label: string) => void
}

const DEFAULT_IDLE_MS = 30_000
const IDLE_SOFT_HTML =
  '🌿 Tudo bem se você precisar de um momento. Estarei aqui quando quiser continuar nossa conversa.'
const IDLE_SOFT_AUDIO =
  'Tudo bem se você precisar de um momento. Estarei aqui quando quiser continuar nossa conversa.'

interface LiaContextValue {
  screen: ScreenId
  messages: ChatMessage[]
  profile: UserProfile
  progress: number
  speechLoading: string | null
  speechPlayback: SpeechPlayback
  speechPlayerEnabled: boolean
  psychOpen: boolean
  idlePromptOpen: boolean
  mapBadge: boolean
  isRecording: boolean
  isTranscribing: boolean
  goToChat: () => void
  showScreen: (id: ScreenId) => void
  openPsych: () => void
  closePsych: () => void
  continueFromIdle: () => void
  endFromIdle: () => void
  sendMessage: (text: string) => void
  toggleMic: () => void
  pickEmotion: (pickerId: string, idx: number, label: string) => void
  listen: (text: string) => void
  primeAudio: () => void
  toggleSpeech: (text: string) => void
  seekSpeech: (text: string, ratio: number) => void
  isSpeechReady: (text: string) => boolean
  getSpeechDuration: (text: string) => number
  speechRate: SpeechRate
  cycleSpeechRate: () => void
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
  const [psychOpen, setPsychOpen] = useState(false)
  const [idlePromptOpen, setIdlePromptOpen] = useState(false)
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(DEFAULT_IDLE_MS)
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
  const lastMicErrorRef = useRef<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idlePromptOpenRef = useRef(false)
  const idleTimeoutMsRef = useRef(DEFAULT_IDLE_MS)

  profileRef.current = profile
  messagesRef.current = messages
  idlePromptOpenRef.current = idlePromptOpen
  idleTimeoutMsRef.current = idleTimeoutMs

  const { speak, listen, toggleSpeech, seekSpeech, unlockAudio, primeAudio, speechLoading, speechPlayback, isSpeechReady, getSpeechDuration, speechRate, cycleSpeechRate } =
    useSpeech(isAiChatEnabled())
  const speechPlayerEnabled = isAiChatEnabled()

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const withoutTyping = prev.filter((m) => m.kind !== 'typing')
      return [...withoutTyping, msg]
    })
  }, [])

  const addMicError = useCallback(
    (spoken: string) => {
      if (lastMicErrorRef.current === spoken) return
      lastMicErrorRef.current = spoken
      appendMessage({
        id: uid(),
        kind: 'ai',
        html: spoken,
        audioText: spoken.replace(/💙/g, '').trim(),
        time: formatTime(),
      })
    },
    [appendMessage],
  )

  const showScreen = useCallback((id: ScreenId) => {
    setScreen(id)
    if (id !== 'chat') {
      setIdlePromptOpen(false)
    }
  }, [])

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer()
    if (idlePromptOpenRef.current) return

    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      if (idlePromptOpenRef.current) return

      appendMessage({
        id: uid(),
        kind: 'ai',
        html: IDLE_SOFT_HTML,
        audioText: IDLE_SOFT_AUDIO,
        time: formatTime(),
      })
      speak(IDLE_SOFT_AUDIO)
      setIdlePromptOpen(true)
    }, idleTimeoutMsRef.current)
  }, [appendMessage, clearIdleTimer, speak])

  const bumpIdleActivity = useCallback(() => {
    if (idlePromptOpenRef.current) return
    scheduleIdleTimer()
  }, [scheduleIdleTimer])

  useEffect(() => {
    void fetchChatSettings()
      .then((settings) => {
        const next =
          settings.idleTimeoutMs === 30_000 ||
          settings.idleTimeoutMs === 60_000 ||
          settings.idleTimeoutMs === 120_000
            ? settings.idleTimeoutMs
            : DEFAULT_IDLE_MS
        setIdleTimeoutMs(next)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (screen !== 'chat' || idlePromptOpen || psychOpen || isRecording || isTranscribing) {
      clearIdleTimer()
      return
    }

    const hasTyping = messages.some((m) => m.kind === 'typing')
    if (hasTyping) {
      clearIdleTimer()
      return
    }

    scheduleIdleTimer()
    return clearIdleTimer
  }, [
    screen,
    idlePromptOpen,
    psychOpen,
    isRecording,
    isTranscribing,
    idleTimeoutMs,
    messages,
    clearIdleTimer,
    scheduleIdleTimer,
  ])

  const chatApi = useMemo<ChatApi>(
    () => ({
      getProfile: () => profileRef.current,
      isAudioEnabled: () => false,
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
      addPicker: (question, audioQ, pills, onPick, options) => {
        const usePills = showQuickReplies() || Boolean(options?.forcePills)
        if (!usePills) {
          if (isMoodQuestion(question)) {
            appendMessage({
              id: uid(),
              kind: 'ai',
              html: OPEN_MOOD_PROMPT.html,
              audioText: OPEN_MOOD_PROMPT.audio,
              time: formatTime(),
            })
            speak(OPEN_MOOD_PROMPT.audio)
            return
          }
          appendMessage({
            id: uid(),
            kind: 'ai',
            html: `${question}<br><br><em>${OPEN_REPLY_HINT}</em>`,
            audioText: audioQ ? `${stripHtml(audioQ)} ${OPEN_REPLY_HINT}` : stripHtml(question),
            time: formatTime(),
          })
          if (audioQ) speak(`${stripHtml(audioQ)} ${OPEN_REPLY_HINT}`)
          return
        }
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
        const filtered = buttons.filter((btn) => {
          const text = `${btn.label} ${btn.sub ?? ''}`
          if (!showJourneys() && /jornada/i.test(text)) return false
          if (!showEmotionalMap() && /mapa/i.test(text)) return false
          return true
        })
        if (filtered.length === 0) return
        appendMessage({ id: uid(), kind: 'ctas', buttons: filtered, time: formatTime() })
      },
      suggestBlock: (journey) => {
        if (!showJourneys()) {
          const buttons = [
            ...(showEmotionalMap()
              ? [
                  {
                    label: 'Ver meu mapa emocional',
                    icon: '📊',
                    style: 'secondary' as const,
                    action: () => setScreen('map'),
                  },
                ]
              : []),
            {
              label: 'Falar com psicólogo',
              icon: '💜',
              style: 'accent' as const,
              sub: 'Plantão disponível 24h',
              action: () => setPsychOpen(true),
            },
          ]
          appendMessage({
            id: uid(),
            kind: 'ctas',
            buttons,
            time: formatTime(),
          })
          speak(
            showEmotionalMap()
              ? 'Estou aqui com você. Você pode ver seu mapa emocional ou falar com um psicólogo do plantão.'
              : 'Estou aqui com você. O plantão psicológico está disponível quando você precisar.',
          )
          return
        }
        appendMessage({ id: uid(), kind: 'suggest', journey, time: formatTime() })
        speak(
          'Com base em como você está, sugiro começar por essa jornada. E lembre-se que o plantão psicológico está sempre disponível.',
        )
      },
      updateMap: () => {
        setMapBadge(true)
        const next = { ...profileRef.current }
        setProfile(next)
        void syncCaregiverProfile(next).catch(() => undefined)
      },
      setProgress: (pct) => setProgress(pct),
      showScreen: (legacyId) => {
        const mapped = screenMap[legacyId] ?? (legacyId as ScreenId)
        setScreen(mapped)
      },
      openPsych: () => {
        setPsychOpen(true)
        void syncCaregiverProfile(profileRef.current, { needsPsych: true }).catch(() => undefined)
      },
      startJourney: (n) => {
        if (!showJourneys()) return
        runnerRef.current?.startJourney(n)
      },
      speak,
    }),
    [appendMessage, speak],
  )

  useEffect(() => {
    void ensureJourneysLoaded(async () => {
      const data = await fetchJourneys()
      return { journeys: data.journeys, source: data.source }
    })
  }, [])

  useEffect(() => {
    runnerRef.current = createJourneyRunner(chatApi)
  }, [chatApi])

  const goToChat = useCallback(() => {
    setIdlePromptOpen(false)
    setScreen('chat')
    setMessages([])
    void unlockAudio()
    setTimeout(() => runnerRef.current?.startIntroFlow(), 400)
  }, [unlockAudio])

  const openPsych = useCallback(() => {
    setPsychOpen(true)
    void syncCaregiverProfile(profileRef.current, { needsPsych: true }).catch(() => undefined)
  }, [])
  const closePsych = useCallback(() => setPsychOpen(false), [])

  const continueFromIdle = useCallback(() => {
    setIdlePromptOpen(false)
  }, [])

  const endFromIdle = useCallback(() => {
    setIdlePromptOpen(false)
    clearIdleTimer()
    setScreen('intro')
  }, [clearIdleTimer])

  const sendMessage = useCallback((text: string) => {
    void unlockAudio()
    bumpIdleActivity()
    runnerRef.current?.sendMessage(text)
  }, [bumpIdleActivity, unlockAudio])

  const startJourney = useCallback((n: number) => {
    if (!showJourneys()) return
    setIdlePromptOpen(false)
    setScreen('chat')
    bumpIdleActivity()
    runnerRef.current?.startJourney(n)
  }, [bumpIdleActivity])

  const pickEmotion = useCallback(
    (pickerId: string, idx: number, label: string) => {
      const handler = pickerHandlers.current.get(pickerId)
      if (!handler) return
      pickerHandlers.current.delete(pickerId)
      bumpIdleActivity()
      appendMessage({ id: uid(), kind: 'user', text: label, time: formatTime() })
      handler.onPick(idx, label)
    },
    [appendMessage, bumpIdleActivity],
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
        lastMicErrorRef.current = null
        mediaStreamRef.current = stream

        const { recorder, format: activeFormat } = createMediaRecorder(stream, format)
        recorderFormatRef.current = activeFormat
        mediaRecorderRef.current = recorder
        audioChunksRef.current = []

        recorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        })

        recorder.addEventListener('stop', () => {
          stream.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          setIsRecording(false)

          const blobType = activeFormat.mimeType || recorder.mimeType || 'audio/mp4'
          const blob = new Blob(audioChunksRef.current, { type: blobType })
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
              const text = await transcribeAudio(blob, `gravacao.${activeFormat.extension}`)
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
        bumpIdleActivity()
      } catch (error) {
        addMicError(micErrorMessage(error))
      }
      return
    }

    mediaRecorderRef.current?.stop()
  }, [addMicError, bumpIdleActivity, chatApi, isRecording, isTranscribing])

  const value: LiaContextValue = {
    screen,
    messages,
    profile,
    progress,
    speechLoading,
    speechPlayback,
    speechPlayerEnabled,
    psychOpen,
    idlePromptOpen,
    mapBadge,
    isRecording,
    isTranscribing,
    goToChat,
    showScreen,
    openPsych,
    closePsych,
    continueFromIdle,
    endFromIdle,
    sendMessage,
    toggleMic,
    pickEmotion,
    listen,
    primeAudio,
    toggleSpeech,
    seekSpeech,
    isSpeechReady,
    getSpeechDuration,
    speechRate,
    cycleSpeechRate,
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
