import type { ChatResponse } from '../services/liaApi'
import type { ChatApi } from '../types/chat'
import { getJourneyByNumber } from '../data/journeys'
import { showJourneys } from '../lib/features'

/**
 * Exibe card de jornada quando a IA retorna recomendação estruturada
 * (JSON no prompt iClinica, parseado no backend).
 */
export function applyJourneyRecommendation(api: ChatApi, response: ChatResponse) {
  if (!showJourneys()) return

  const number = response.journeyRecommendation?.number
  if (!number) return

  const journey = getJourneyByNumber(number)
  setTimeout(
    () =>
      api.showTyping(() => {
        api.suggestBlock(journey)
      }, 900),
    700,
  )
}
