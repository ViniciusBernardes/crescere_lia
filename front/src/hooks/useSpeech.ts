import { useCallback, useEffect, useRef } from 'react'
import { fetchSpeechAudio } from '../services/liaApi'
import { cacheSpeech, getCachedSpeech } from '../services/ttsCache'

function cleanSpeechText(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
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

export function useSpeech(audioEnabled: boolean, useOpenAiVoice: boolean) {
  const synthRef = useRef(window.speechSynthesis)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const unlockedRef = useRef(false)
  const voicesReadyRef = useRef(false)

  useEffect(() => {
    const synth = synthRef.current
    if (!synth) return

    const loadVoices = () => {
      voicesReadyRef.current = synth.getVoices().length > 0
    }

    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)
    return () => synth.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const stopPlayback = useCallback(() => {
    requestIdRef.current += 1

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

      const cleanup = () => {
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
        }
        if (audioRef.current === audio) audioRef.current = null
      }

      audio.onended = cleanup
      audio.onerror = () => {
        cleanup()
        if (requestId === requestIdRef.current) speakWithBrowser(text)
      }

      void audio.play().catch(() => {
        cleanup()
        if (requestId === requestIdRef.current) speakWithBrowser(text)
      })
    },
    [speakWithBrowser],
  )

  const playText = useCallback(
    (text: string, options?: { manual?: boolean; preloaded?: Blob }) => {
      const manual = options?.manual ?? false
      if (!manual && !audioEnabled) return

      const clean = cleanSpeechText(text)
      if (!clean) return

      stopPlayback()

      const requestId = ++requestIdRef.current

      if (!useOpenAiVoice) {
        speakWithBrowser(clean)
        return
      }

      const cached = options?.preloaded ?? getCachedSpeech(clean)
      if (cached) {
        playAudioBlob(cached, clean, requestId)
        return
      }

      void unlockAudio()

      void fetchSpeechAudio(clean)
        .then((blob) => {
          cacheSpeech(clean, blob)
          playAudioBlob(blob, clean, requestId)
        })
        .catch((error) => {
          console.warn('[speech] OpenAI TTS indisponível, usando voz do navegador.', error)
          if (requestId === requestIdRef.current) speakWithBrowser(clean)
        })
    },
    [audioEnabled, useOpenAiVoice, speakWithBrowser, stopPlayback, playAudioBlob, unlockAudio],
  )

  const speak = useCallback(
    (text: string, preloaded?: Blob) => playText(text, { preloaded }),
    [playText],
  )

  const listen = useCallback(
    (text: string) => {
      void unlockAudio().finally(() => playText(text, { manual: true }))
    },
    [unlockAudio, playText],
  )

  return { speak, listen, cancel: stopPlayback, unlockAudio }
}
