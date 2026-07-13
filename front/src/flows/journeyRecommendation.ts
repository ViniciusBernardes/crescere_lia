import type { ChatResponse } from '../services/liaApi'
import type { ChatApi } from '../types/chat'
import { getJourneyByNumber } from '../data/journeys'
import { showJourneys } from '../lib/features'

/** Infere jornada a partir do texto do cuidador (fallback quando a IA não envia JSON). */
export function inferJourneyNumberFromUserText(text: string): number | null {
  const l = text.toLowerCase()

  if (/crise|desespero|colaps|não aguento|nao aguento|no limite/.test(l)) return 9
  if (/cansad|exaust|esgot|sem forças|sem forcas/.test(l)) return 5
  if (/culpa|culpad|me cobr/.test(l)) return 5
  if (/diagnósti|diagnosti|autis|\btea\b/.test(l)) return 3
  if (/confus|perdid|informação demais|informacao demais/.test(l)) return 2
  if (/escola|inclus|professor|bullying/.test(l)) return 12
  if (/sozin|sem apoio|rede de apoio/.test(l)) return 7
  if (/direito|benefício|beneficio|laudo/.test(l)) return 8

  return null
}

function inferJourneyNumberFromReply(reply: string): number | null {
  const patterns = [
    /jornada\s*(\d{1,2})\s*[—\-–:]/i,
    /jornada\s*(\d{1,2})\b/i,
    /\bJ(\d{1,2})\s*[—\-–:]/i,
  ]

  for (const pattern of patterns) {
    const match = reply.match(pattern)
    if (!match) continue
    const number = Number(match[1])
    if (Number.isFinite(number) && number >= 1) return number
  }

  return null
}

export function resolveSuggestedJourneyNumber(
  response: ChatResponse,
  userText?: string,
): number | null {
  if (response.journeyRecommendation?.number) {
    return response.journeyRecommendation.number
  }

  const fromReply = inferJourneyNumberFromReply(response.reply)
  if (fromReply) return fromReply

  if (userText?.trim()) {
    return inferJourneyNumberFromUserText(userText)
  }

  return null
}

/**
 * Exibe card de jornada quando a IA recomenda (JSON/texto) ou quando o tema do cuidador indica jornada.
 */
export function applyJourneyRecommendation(
  api: ChatApi,
  response: ChatResponse,
  userText?: string,
) {
  if (!showJourneys()) return

  const number = resolveSuggestedJourneyNumber(response, userText)
  if (!number) return

  const journey = getJourneyByNumber(number)
  setTimeout(() => api.suggestBlock(journey), 900)
}
