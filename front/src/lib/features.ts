/** Jornadas guiadas no app do cuidador (ligadas via VITE_SHOW_JOURNEYS). */
export function showJourneys(): boolean {
  return import.meta.env.VITE_SHOW_JOURNEYS === 'true'
}

/** Mapa emocional desativado temporariamente no chat do cuidador. */
export function showEmotionalMap(): boolean {
  return import.meta.env.VITE_SHOW_EMOTIONAL_MAP === 'true'
}

/** Pílulas de resposta rápida (emoções etc.) desativadas — conversa livre no chat. */
export function showQuickReplies(): boolean {
  return import.meta.env.VITE_SHOW_QUICK_REPLIES === 'true'
}
