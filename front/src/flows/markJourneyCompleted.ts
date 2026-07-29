import type { ChatApi } from '../types/chat'

/** Marca jornada concluída só no fim real — sincroniza mapa/progresso/iClinica. */
export function markJourneyCompleted(api: ChatApi, journeyNumber: number): void {
  const profile = api.getProfile()
  if (!profile.journeysCompleted.includes(journeyNumber)) {
    profile.journeysCompleted.push(journeyNumber)
  }
  api.setProgress(Math.min(100, profile.journeysCompleted.length * 8 + 10))
  api.updateMap()
}
