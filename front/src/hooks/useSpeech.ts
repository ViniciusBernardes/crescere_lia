import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSpeechAudio } from '../services/liaApi'
import { cacheSpeech, getCachedSpeech } from '../services/ttsCache'
import {
  loadSpeechRate,
  nextSpeechRate,
  saveSpeechRate,
  type SpeechRate,
} from '../utils/speechRate'

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
  const unlockAudioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const unlockedRef = useRef(false)
  const durationsRef = useRef<Map<string, number>>(new Map())
  const activeTextRef = useRef<string | null>(null)
  const speakWithBrowserRef = useRef<(text: string) => void>(() => {})

  const [speechLoading, setSpeechLoading] = useState<string | null>(null)
  const [speechPlayback, setSpeechPlayback] = useState<SpeechPlayback>(emptyPlayback)
  const [readyVersion, setReadyVersion] = useState(0)
  const [speechRate, setSpeechRate] = useState<SpeechRate>(() => loadSpeechRate())
  const speechRateRef = useRef(speechRate)

  speechRateRef.current = speechRate

  const applySpeechRate = useCallback((audio: HTMLAudioElement) => {
    audio.defaultPlaybackRate = speechRateRef.current
    audio.playbackRate = speechRateRef.current
  }, [])

  const syncFromElement = useCallback(() => {
    const audio = audioRef.current
    const text = activeTextRef.current
    if (!audio || !text) return

    const duration = audio.duration || durationsRef.current.get(text) || 0
    if (duration > 0) {
      durationsRef.current.set(text, duration)
    }

    setSpeechPlayback({
      text,
      playing: !audio.paused && !audio.ended,
      currentTime: audio.currentTime,
      duration,
    })
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

  useEffect(() => {
    const audio = document.createElement('audio')
    configureAudioElement(audio)
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audioRef.current = audio

    const unlock = document.createElement('audio')
    configureAudioElement(unlock)
    unlock.src = SILENT_WAV
    unlock.style.display = 'none'
    document.body.appendChild(unlock)
    unlockAudioRef.current = unlock

    const onPlay = () => syncFromElement()
    const onPause = () => syncFromElement()
    const onTimeUpdate = () => syncFromElement()
    const onEnded = () => syncFromElement()
    const onLoadedMetadata = () => syncFromElement()

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.pause()
      unlock.pause()
      document.body.removeChild(audio)
      document.body.removeChild(unlock)
      audioRef.current = null
      unlockAudioRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [syncFromElement])

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

  const speakWithBrowser = useCallback((text: string) => {
    if (!synthRef.current) return

    synthRef.current.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = Math.min(1.1, Math.max(0.6, speechRateRef.current * 0.95))
    utterance.pitch = 1.05

    const voice = pickBrowserVoice(synthRef.current)
    if (voice) utterance.voice = voice

    synthRef.current.speak(utterance)
  }, [])

  speakWithBrowserRef.current = speakWithBrowser

  const stopPlayback = useCallback(() => {
    requestIdRef.current += 1
    setSpeechLoading(null)
    setSpeechPlayback(emptyPlayback)
    activeTextRef.current = null

    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.oncanplay = null
      audio.removeAttribute('src')
      audio.load()
    }

    revokeObjectUrl()
    synthRef.current?.cancel()
  }, [revokeObjectUrl])

  /** Desbloqueia áudio no iOS sem tocar no player principal. */
  const primeAudio = useCallback(() => {
    if (unlockedRef.current) return

    const unlock = unlockAudioRef.current
    if (!unlock) return

    void unlock
      .play()
      .then(() => {
        unlockedRef.current = true
        unlock.pause()
        unlock.currentTime = 0
      })
      .catch(() => {
        /* ignore */
      })
  }, [])

  const unlockAudio = useCallback(() => {
    primeAudio()
    return Promise.resolve()
  }, [primeAudio])

  const loadTrack = useCallback(
    (blob: Blob, text: string, requestId: number, seekTo = 0) => {
      const audio = audioRef.current
      if (!audio || requestId !== requestIdRef.current) return

      activeTextRef.current = text
      revokeObjectUrl()

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const startPlayback = () => {
        if (requestId !== requestIdRef.current) return
        if (seekTo > 0) {
          audio.currentTime = seekTo
        }
        applySpeechRate(audio)
        void audio.play().catch(() => {
          if (requestId === requestIdRef.current) {
            speakWithBrowserRef.current(text)
          }
        })
      }

      audio.oncanplay = null
      audio.onerror = () => {
        if (requestId === requestIdRef.current) {
          speakWithBrowserRef.current(text)
        }
      }

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
    [revokeObjectUrl, applySpeechRate],
  )

  const cycleSpeechRate = useCallback(() => {
    setSpeechRate((current) => {
      const next = nextSpeechRate(current)
      saveSpeechRate(next)
      if (audioRef.current) {
        applySpeechRate(audioRef.current)
      }
      return next
    })
  }, [applySpeechRate])

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
        loadTrack(cached, clean, requestId)
        return
      }

      if (!manual) return

      setSpeechLoading(clean)

      void fetchSpeechAudio(clean)
        .then((blob) => {
          if (requestId !== requestIdRef.current) return
          registerBlob(clean, blob)
          loadTrack(blob, clean, requestId)
        })
        .catch((error) => {
          console.warn('[speech] OpenAI TTS indisponível, usando voz do navegador.', error)
          if (requestId === requestIdRef.current) speakWithBrowser(clean)
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setSpeechLoading(null)
        })
    },
    [useOpenAiVoice, speakWithBrowser, stopPlayback, loadTrack, primeAudio, registerBlob],
  )

  const toggleSpeech = useCallback(
    (text: string) => {
      const clean = cleanSpeechText(text)
      if (!clean) return

      primeAudio()

      const audio = audioRef.current
      if (!audio) return

      if (activeTextRef.current === clean && objectUrlRef.current) {
        if (!audio.paused && !audio.ended) {
          audio.pause()
          syncFromElement()
          return
        }

        const resumeTime = audio.ended ? 0 : audio.currentTime
        if (audio.ended) {
          audio.currentTime = 0
        }

        applySpeechRate(audio)
        void audio.play().catch(() => {
          const cached = getCachedSpeech(clean)
          if (!cached) {
            speakWithBrowserRef.current(clean)
            return
          }
          const requestId = ++requestIdRef.current
          loadTrack(cached, clean, requestId, resumeTime)
        })
        return
      }

      const cached = getCachedSpeech(clean)
      if (cached) {
        if (activeTextRef.current && activeTextRef.current !== clean) {
          stopPlayback()
        }
        const requestId = ++requestIdRef.current
        registerBlob(clean, cached)
        loadTrack(cached, clean, requestId)
        return
      }

      playText(text, { manual: true })
    },
    [playText, primeAudio, loadTrack, registerBlob, stopPlayback, syncFromElement, applySpeechRate],
  )

  const seekSpeech = useCallback(
    (text: string, ratio: number) => {
      const clean = cleanSpeechText(text)
      const audio = audioRef.current
      if (!audio || activeTextRef.current !== clean) return

      const duration = audio.duration || durationsRef.current.get(clean) || 0
      if (duration <= 0) return

      const nextTime = Math.min(duration, Math.max(0, ratio * duration))
      audio.currentTime = nextTime
      syncFromElement()
    },
    [syncFromElement],
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
    speechRate,
    cycleSpeechRate,
    speechLoading,
    speechPlayback,
    isSpeechReady,
    getSpeechDuration,
  }
}
