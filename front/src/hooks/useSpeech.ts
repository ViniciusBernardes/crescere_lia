import { useCallback, useRef } from 'react'

export function useSpeech(enabled: boolean) {
  const synthRef = useRef(window.speechSynthesis)

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !synthRef.current) return
      synthRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''))
      utterance.lang = 'pt-BR'
      utterance.rate = 0.93
      utterance.pitch = 1.05
      synthRef.current.speak(utterance)
    },
    [enabled],
  )

  const cancel = useCallback(() => {
    synthRef.current?.cancel()
  }, [])

  return { speak, cancel }
}
