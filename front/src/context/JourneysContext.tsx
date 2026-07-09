import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getStaticJourneys, loadJourneysCatalog, resolveJourney } from '../services/journeysCatalog'
import type { JourneyItem } from '../types/chat'

type JourneysContextValue = {
  journeys: JourneyItem[]
  loading: boolean
  source: 'api' | 'static' | 'pending'
  total: number
  findJourney: (n: number) => JourneyItem | undefined
  resolveJourney: (n: number) => JourneyItem
}

const JourneysContext = createContext<JourneysContextValue | null>(null)

export function JourneysProvider({ children }: { children: ReactNode }) {
  const [journeys, setJourneys] = useState<JourneyItem[]>(getStaticJourneys)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<JourneysContextValue['source']>('pending')

  useEffect(() => {
    let cancelled = false

    void loadJourneysCatalog()
      .then((result) => {
        if (cancelled) return
        setJourneys(result.journeys)
        setSource(result.source)
      })
      .catch(() => {
        if (cancelled) return
        setJourneys(getStaticJourneys())
        setSource('static')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<JourneysContextValue>(
    () => ({
      journeys,
      loading,
      source,
      total: journeys.length,
      findJourney: (n) => journeys.find((j) => j.n === n),
      resolveJourney: (n) => resolveJourney(journeys, n),
    }),
    [journeys, loading, source],
  )

  return <JourneysContext.Provider value={value}>{children}</JourneysContext.Provider>
}

export function useJourneys(): JourneysContextValue {
  const ctx = useContext(JourneysContext)
  if (!ctx) {
    throw new Error('useJourneys deve ser usado dentro de JourneysProvider')
  }
  return ctx
}
