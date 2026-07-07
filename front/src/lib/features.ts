/** Jornadas guiadas são visíveis apenas no portal do psicólogo (telemedicina), não no app do cuidador. */
export function showJourneys(): boolean {
  return import.meta.env.VITE_SHOW_JOURNEYS === 'true'
}
