import { JOURNEYS as STATIC_JOURNEYS } from '../data/journeys'
import type { JourneyItem, JourneyQuestion } from '../types/chat'
import { fetchJourneysCatalog, type LiaJourneyFromApi, type LiaJourneyQuestion } from './liaApi'

const FALLBACK_BY_NUMBER = new Map(STATIC_JOURNEYS.map((j) => [j.n, j]))

function mapQuestion(q: LiaJourneyQuestion): JourneyQuestion {
  return {
    id: q.id,
    sort_order: q.sort_order,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? [],
  }
}

function formatSubtitle(subtitle: string | null, fallback?: JourneyItem): string {
  if (subtitle?.trim()) {
    const clean = subtitle.trim().replace(/^["']|["']$/g, '')
    return `"${clean}"`
  }
  return fallback?.sub ?? ''
}

export function mapApiJourneyToItem(journey: LiaJourneyFromApi): JourneyItem {
  const fallback = FALLBACK_BY_NUMBER.get(journey.number)
  return {
    n: journey.number,
    icon: journey.icon?.trim() || fallback?.icon || '🌿',
    title: journey.title,
    sub: formatSubtitle(journey.subtitle, fallback),
    color: journey.color?.trim() || fallback?.color || '#8B6BB1',
    questions:
      journey.questions?.length > 0
        ? [...journey.questions]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(mapQuestion)
        : undefined,
  }
}

export function getStaticJourneys(): JourneyItem[] {
  return STATIC_JOURNEYS
}

export function findJourneyByNumber(journeys: JourneyItem[], n: number): JourneyItem | undefined {
  return journeys.find((j) => j.n === n)
}

export function resolveJourney(journeys: JourneyItem[], n: number): JourneyItem {
  return findJourneyByNumber(journeys, n) ?? journeys[0] ?? STATIC_JOURNEYS[0]
}

export async function loadJourneysCatalog(): Promise<{
  journeys: JourneyItem[]
  source: 'api' | 'static'
}> {
  try {
    const data = await fetchJourneysCatalog()
    const journeys = data.journeys
      .map(mapApiJourneyToItem)
      .sort((a, b) => a.n - b.n)

    if (journeys.length > 0) {
      return { journeys, source: 'api' }
    }
  } catch {
    // fallback abaixo
  }

  return { journeys: getStaticJourneys(), source: 'static' }
}
