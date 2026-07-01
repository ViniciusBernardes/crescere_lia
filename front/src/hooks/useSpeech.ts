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

function probeDuration(blob: Blob, onReady: (duration: number) => void) {
  const url = URL.createObjectURL(blob)
  const probe = new Audio(url)

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

  const stopPlayback = useCallback(() => {
    requestIdRef.current += 1
    setSpeechLoading(null)
    setSpeechPlayback(emptyPlayback)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    synthRef.current?.cancel()
  }, [])

  const unlockAudio = useCallback(() => {
    if (unlockedRef.current) return Promise.resolve()

    const silent = new Audio(SILENT_WAV)
    silent.volume = 0.01

    return silent
      .play()
      .then(() => {
        unlockedRef.current = true
      })
      .catch(() => {
        /* ignore — browser may still allow playback after explicit click */
      })
  }, [])

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

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

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
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
        }
        if (audioRef.current === audio) audioRef.current = null
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

      void audio.play().catch(() => {
        cleanup()
        if (requestId === requestIdRef.current) speakWithBrowser(text)
      })
    },
    [rememberDuration, speakWithBrowser],
  )

  const playText = useCallback(
    async (text: string, options?: { manual?: boolean; preloaded?: Blob }) => {
      const manual = options?.manual ?? false
      const clean = cleanSpeechText(text)
      if (!clean) return

      if (!manual && !options?.preloaded) return

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
      await unlockAudio()

      try {
        const blob = await fetchSpeechAudio(clean)
        if (requestId !== requestIdRef.current) return
        registerBlob(clean, blob)
        playAudioBlob(blob, clean, requestId)
      } catch (error) {
        console.warn('[speech] OpenAI TTS indisponível, usando voz do navegador.', error)
        if (requestId === requestIdRef.current) speakWithBrowser(clean)
      } finally {
        if (requestId === requestIdRef.current) setSpeechLoading(null)
      }
    },
    [useOpenAiVoice, speakWithBrowser, stopPlayback, playAudioBlob, unlockAudio, registerBlob],
  )

  const toggleSpeech = useCallback(
    async (text: string) => {
      const clean = cleanSpeechText(text)
      if (!clean) return

      const cached = getCachedSpeech(clean)
      const isActive = speechPlayback.text === clean && audioRef.current

      if (isActive && audioRef.current) {
        if (speechPlayback.playing) {
          audioRef.current.pause()
        } else {
          await unlockAudio()
          void audioRef.current.play()
        }
        return
      }

      if (cached && !audioRef.current) {
        let requestId = requestIdRef.current
        if (speechPlayback.text && speechPlayback.text !== clean) {
          stopPlayback()
          requestId = requestIdRef.current
        }
        requestId = ++requestIdRef.current
        registerBlob(clean, cached)
        await unlockAudio()
        playAudioBlob(cached, clean, requestId)
        return
      }

      await unlockAudio()
      await playText(text, { manual: true })
    },
    [speechPlayback, playText, unlockAudio, playAudioBlob, registerBlob, stopPlayback],
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
      void playText(text, { preloaded })
    },
    [playText],
  )

  const listen = useCallback(
    (text: string) => {
      void toggleSpeech(text)
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
    speechLoading,
    speechPlayback,
    isSpeechReady,
    getSpeechDuration,
  }
}
