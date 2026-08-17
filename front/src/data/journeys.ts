import type { JourneyItem, JourneyQuestion } from '../types/chat'

const FALLBACK_JOURNEYS: JourneyItem[] = [
  { n: 1, icon: '🤗', title: 'Acolhimento e Chegada', sub: '"Você não está sozinho"', color: '#8B6BB1' },
  { n: 2, icon: '🧩', title: 'Compreendendo o TEA', sub: '"Informação que acolhe e aproxima"', color: '#9B75C7' },
  { n: 3, icon: '💭', title: 'Sentimentos diante do diagnóstico', sub: '"Tudo que você sente merece espaço"', color: '#7B5BA8' },
  { n: 4, icon: '🔍', title: 'Autoavaliação e Autopercepção', sub: '"Como você está, de verdade?"', color: '#6347A0' },
  { n: 5, icon: '🌱', title: 'Cuidar de Si para Continuar', sub: '"Você também precisa de cuidado"', color: '#8B6BB1' },
  { n: 6, icon: '🛠️', title: 'Estratégias de Manejo com a Criança', sub: '"Compreender antes de reagir"', color: '#9B75C7' },
  { n: 7, icon: '🤝', title: 'A Rede de Apoio', sub: '"Cuidar é um trabalho coletivo"', color: '#7B5BA8' },
  { n: 8, icon: '📋', title: 'Direitos, Deveres e Orientações', sub: '"Informação também é cuidado"', color: '#6347A0' },
  { n: 9, icon: '🌊', title: 'Momentos de Crise', sub: '"Quando tudo parece demais"', color: '#8B6BB1' },
  { n: 10, icon: '⚡', title: 'Como o Cérebro Aprende', sub: '"Entender o cérebro muda o cuidado"', color: '#9B75C7' },
  { n: 11, icon: '🌟', title: 'Potencialidades, Identidade e Futuro', sub: '"Para além do diagnóstico"', color: '#7B5BA8' },
  { n: 12, icon: '🏫', title: 'Escola, Sociedade e Inclusão', sub: '"Cuidar também é enfrentar o mundo"', color: '#6347A0' },
]

let journeysCache: JourneyItem[] = [...FALLBACK_JOURNEYS]
let journeysSource: 'iclinica' | 'fallback' = 'fallback'
let loadPromise: Promise<void> | null = null

/** @deprecated use getJourneys() — mantido para imports legados durante a migração */
export const JOURNEYS: JourneyItem[] = journeysCache

export function getJourneys(): JourneyItem[] {
  return journeysCache
}

export function getJourneyByNumber(n: number): JourneyItem {
  return journeysCache.find((j) => j.n === n) ?? journeysCache[0] ?? FALLBACK_JOURNEYS[0]
}

export function getJourneyQuestions(n: number): JourneyQuestion[] {
  const journey = journeysCache.find((j) => j.n === n)
  return [...(journey?.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

export function getJourneySteps(n: number) {
  const journey = journeysCache.find((j) => j.n === n)
  return [...(journey?.steps ?? [])]
}

export function getJourneysSource(): 'iclinica' | 'fallback' {
  return journeysSource
}

export function setJourneysFromApi(journeys: JourneyItem[], source: 'iclinica' | 'fallback') {
  journeysCache = journeys.length > 0 ? journeys : [...FALLBACK_JOURNEYS]
  journeysSource = source
  JOURNEYS.length = 0
  JOURNEYS.push(...journeysCache)
}

export async function ensureJourneysLoaded(
  loader: () => Promise<{ journeys: JourneyItem[]; source: 'iclinica' | 'fallback' }>,
): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = loader()
    .then(({ journeys, source }) => {
      setJourneysFromApi(journeys, source)
    })
    .catch(() => {
      setJourneysFromApi(FALLBACK_JOURNEYS, 'fallback')
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

export function getFallbackJourneys(): JourneyItem[] {
  return [...FALLBACK_JOURNEYS]
}
