import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSpeechAudio } from '../services/liaApi'
import { cacheSpeech, getCachedSpeech } from '../services/ttsCache'

export function cleanSpeechText(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export interface SpeechPlayback {
  text: string | null
  playing: boolean
  currentTime: number
  duration: number
}

const emptyPlayback: SpeechPlayback = {
  text: null,
  playing: false,
  currentTime: 0,
  duration: 0,
}

function pickBrowserVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  const ptVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('pt'))

  const feminine =
    ptVoices.find((voice) =>
      /female|feminina|maria|luciana|francisca|vit[oó]ria|camila|fernanda|google portugu[eê]s do brasil/i.test(
        voice.name,
      ),
    ) ??
    ptVoices.find((voice) => !/male|masculin|joão|daniel|felipe|google portugu[eê]s/i.test(voice.name))

  return feminine ?? ptVoices[0] ?? voices.find((voice) => voice.lang.startsWith('pt')) ?? null
}

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function configureAudioElement(audio: HTMLAudioElement) {
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  audio.preload = 'auto'
  ;(audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
}

function probeDuration(blob: Blob, onReady: (duration: number) => void) {
  const url = URL.createObjectURL(blob)
  const probe = new Audio(url)
  configureAudioElement(probe)

  probe.onloadedmetadata = () => {
    if (probe.duration && Number.isFinite(probe.duration)) {
      onReady(probe.duration)
    }
    URL.revokeObjectURL(url)
  }

  probe.onerror = () => {
    URL.revokeObjectURL(url)
  }
}

export function useSpeech(useOpenAiVoice: boolean) {
  const synthRef = useRef(window.speechSynthesis)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const unlockedRef = useRef(false)
  const durationsRef = useRef<Map<string, number>>(new Map())

  const [speechLoading, setSpeechLoading] = useState<string | null>(null)
  const [speechPlayback, setSpeechPlayback] = useState<SpeechPlayback>(emptyPlayback)
  const [readyVersion, setReadyVersion] = useState(0)

  const ensureAudioElement = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      configureAudioElement(audioRef.current)
    }
    return audioRef.current
  }, [])

  useEffect(() => {
    const synth = synthRef.current
    if (!synth) return

    const loadVoices = () => {
      synth.getVoices()
    }

    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)
    return () => synth.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const rememberDuration = useCallback((key: string, duration: number) => {
    if (!duration || !Number.isFinite(duration)) return
    durationsRef.current.set(key, duration)
    setReadyVersion((v) => v + 1)
  }, [])

  const registerBlob = useCallback(
    (key: string, blob: Blob) => {
      cacheSpeech(key, blob)
      if (!durationsRef.current.has(key)) {
        probeDuration(blob, (duration) => rememberDuration(key, duration))
      }
      setReadyVersion((v) => v + 1)
    },
    [rememberDuration],
  )

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stopPlayback = useCallback(() => {
    requestIdRef.current += 1
    setSpeechLoading(null)
    setSpeechPlayback(emptyPlayback)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.oncanplay = null
      audioRef.current.onloadedmetadata = null
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }

    revokeObjectUrl()
    synthRef.current?.cancel()
  }, [revokeObjectUrl])

  /** Deve ser chamado de forma síncrona no toque/clique (crítico no iOS Safari). */
  const primeAudio = useCallback(() => {
    const audio = ensureAudioElement()
    if (unlockedRef.current) return

    audio.volume = 0.01
    audio.src = SILENT_WAV
    void audio
      .play()
      .then(() => {
        unlockedRef.current = true
        audio.pause()
        audio.volume = 1
        audio.removeAttribute('src')
        audio.load()
      })
      .catch(() => {
        /* tentativa de desbloqueio — o play real pode ainda funcionar após o fetch */
      })
  }, [ensureAudioElement])

  const unlockAudio = useCallback(() => {
    primeAudio()
    return Promise.resolve()
  }, [primeAudio])

  const speakWithBrowser = useCallback((text: string) => {
    if (!synthRef.current) return

    synthRef.current.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 0.93
    utterance.pitch = 1.05

    const voice = pickBrowserVoice(synthRef.current)
    if (voice) utterance.voice = voice

    synthRef.current.speak(utterance)
  }, [])

  const playAudioBlob = useCallback(
    (blob: Blob, text: string, requestId: number) => {
      if (requestId !== requestIdRef.current) return

      revokeObjectUrl()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = ensureAudioElement()

      const sync = (playing: boolean) => {
        if (requestId !== requestIdRef.current) return
        const duration = audio.duration || durationsRef.current.get(text) || 0
        if (duration > 0) rememberDuration(text, duration)
        setSpeechPlayback({
          text,
          playing,
          currentTime: audio.currentTime,
          duration,
        })
      }

      const cleanup = () => {
        revokeObjectUrl()
      }

      audio.onloadedmetadata = () => {
        if (requestId !== requestIdRef.current) return
        rememberDuration(text, audio.duration)
        setSpeechPlayback((prev) =>
          prev.text === text
            ? { ...prev, duration: audio.duration }
            : { text, playing: false, currentTime: 0, duration: audio.duration },
        )
      }

      audio.ontimeupdate = () => {
        if (requestId !== requestIdRef.current) return
        setSpeechPlayback((prev) =>
          prev.text === text ? { ...prev, currentTime: audio.currentTime } : prev,
        )
      }

      audio.onplay = () => sync(true)
      audio.onpause = () => sync(false)
      audio.onended = () => {
        if (requestId !== requestIdRef.current) return
        const duration = audio.duration || durationsRef.current.get(text) || 0
        setSpeechPlayback({ text, playing: false, currentTime: 0, duration })
        cleanup()
      }

      audio.onerror = () => {
        cleanup()
        if (requestId === requestIdRef.current) speakWithBrowser(text)
      }

      const startPlayback = () => {
        if (requestId !== requestIdRef.current) return
        void audio.play().catch(() => {
          cleanup()
          if (requestId === requestIdRef.current) speakWithBrowser(text)
        })
      }

      audio.oncanplay = null
      audio.src = url
      audio.load()

      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        startPlayback()
      } else {
        audio.oncanplay = () => {
          audio.oncanplay = null
          startPlayback()
        }
      }
    },
    [ensureAudioElement, rememberDuration, revokeObjectUrl, speakWithBrowser],
  )

  const playText = useCallback(
    (text: string, options?: { manual?: boolean; preloaded?: Blob }) => {
      const manual = options?.manual ?? false
      const clean = cleanSpeechText(text)
      if (!clean) return

      if (!manual && !options?.preloaded) return

      primeAudio()
      stopPlayback()

      const requestId = ++requestIdRef.current

      if (!useOpenAiVoice) {
        speakWithBrowser(clean)
        return
      }

      const cached = options?.preloaded ?? getCachedSpeech(clean)
      if (cached) {
        registerBlob(clean, cached)
        playAudioBlob(cached, clean, requestId)
        return
      }

      if (!manual) return

      setSpeechLoading(clean)

      void fetchSpeechAudio(clean)
        .then((blob) => {
          if (requestId !== requestIdRef.current) return
          registerBlob(clean, blob)
          playAudioBlob(blob, clean, requestId)
        })
        .catch((error) => {
          console.warn('[speech] OpenAI TTS indisponível, usando voz do navegador.', error)
          if (requestId === requestIdRef.current) speakWithBrowser(clean)
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setSpeechLoading(null)
        })
    },
    [useOpenAiVoice, speakWithBrowser, stopPlayback, playAudioBlob, primeAudio, registerBlob],
  )

  const toggleSpeech = useCallback(
    (text: string) => {
      const clean = cleanSpeechText(text)
      if (!clean) return

      primeAudio()

      const cached = getCachedSpeech(clean)
      const isActive = speechPlayback.text === clean && audioRef.current?.src

      if (isActive && audioRef.current) {
        if (speechPlayback.playing) {
          audioRef.current.pause()
        } else {
          void audioRef.current.play().catch(() => speakWithBrowser(clean))
        }
        return
      }

      if (cached && !audioRef.current?.src) {
        if (speechPlayback.text && speechPlayback.text !== clean) {
          stopPlayback()
        }
        const requestId = ++requestIdRef.current
        registerBlob(clean, cached)
        playAudioBlob(cached, clean, requestId)
        return
      }

      playText(text, { manual: true })
    },
    [speechPlayback, playText, primeAudio, playAudioBlob, registerBlob, stopPlayback, speakWithBrowser],
  )

  const seekSpeech = useCallback(
    (text: string, ratio: number) => {
      const clean = cleanSpeechText(text)
      if (!audioRef.current || speechPlayback.text !== clean) return

      const duration = audioRef.current.duration || durationsRef.current.get(clean) || 0
      if (duration <= 0) return

      const nextTime = Math.min(duration, Math.max(0, ratio * duration))
      audioRef.current.currentTime = nextTime
      setSpeechPlayback((prev) =>
        prev.text === clean ? { ...prev, currentTime: nextTime, duration } : prev,
      )
    },
    [speechPlayback.text],
  )

  const isSpeechReady = useCallback(
    (text: string) => {
      const clean = cleanSpeechText(text)
      return Boolean(clean && getCachedSpeech(clean))
    },
    [readyVersion],
  )

  const getSpeechDuration = useCallback(
    (text: string) => {
      const clean = cleanSpeechText(text)
      if (speechPlayback.text === clean && speechPlayback.duration > 0) {
        return speechPlayback.duration
      }
      return durationsRef.current.get(clean) ?? 0
    },
    [speechPlayback, readyVersion],
  )

  const speak = useCallback(
    (text: string, preloaded?: Blob) => {
      playText(text, { preloaded })
    },
    [playText],
  )

  const listen = useCallback(
    (text: string) => {
      toggleSpeech(text)
    },
    [toggleSpeech],
  )

  return {
    speak,
    listen,
    toggleSpeech,
    seekSpeech,
    cancel: stopPlayback,
    unlockAudio,
    primeAudio,
    speechLoading,
    speechPlayback,
    isSpeechReady,
    getSpeechDuration,
  }
}
