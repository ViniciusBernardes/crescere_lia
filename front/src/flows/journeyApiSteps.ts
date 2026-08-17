import type { CtaButton, CtaStyle, JourneyItem, PillOption } from '../types/chat'
import type { UserProfile } from '../types/profile'
import type { JourneyDeps, JourneyStep } from './journeyAiSteps'

export type JourneyExtraDto = {
  kind: 'info_card' | 'quote' | 'reflection'
  title?: string
  items?: string[]
  body?: string
}

export type JourneyStepDto = {
  type: 'ai' | 'picker' | 'ctas'
  instruction?: string
  fallback_text?: string
  extras?: JourneyExtraDto[]
  question?: string
  audio_q?: string
  pills?: Array<{ emoji?: string; label: string } | string>
  pick_instruction?: string
  profile?: Record<string, unknown>
  ctas?: Array<Record<string, unknown>>
  set_progress?: number
}

export function parseApiJourneySteps(raw: unknown, deps: JourneyDeps): JourneyStep[] {
  if (!Array.isArray(raw)) return []
  const steps: JourneyStep[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const parsed = parseStep(item as JourneyStepDto, deps)
    if (parsed) steps.push(parsed)
  }
  return steps
}

function parseStep(step: JourneyStepDto, deps: JourneyDeps): JourneyStep | null {
  if (step.type === 'ai') {
    const instruction = String(step.instruction ?? '').trim()
    if (!instruction) return null
    const fallback = String(step.fallback_text ?? '').trim()
    return {
      type: 'ai',
      instruction,
      fallbackHtml: fallback || undefined,
      extras: extrasToHtml(step.extras),
    }
  }

  if (step.type === 'picker') {
    const question = String(step.question ?? '').trim()
    const pills = parsePills(step.pills)
    if (!question || pills.length < 2) return null
    const pickInstruction = String(step.pick_instruction ?? '').trim() || question
    return {
      type: 'picker',
      question,
      audioQ: String(step.audio_q ?? '').trim() || question,
      pills,
      pickInstruction,
      extras: extrasToHtml(step.extras),
      onPick: (profile, idx, label) => applyJourneyProfile(profile, step.profile, idx, label),
    }
  }

  if (step.type === 'ctas') {
    const buttons = (step.ctas ?? [])
      .map((cta) => parseCta(cta, deps))
      .filter((cta): cta is CtaButton => Boolean(cta))
    if (buttons.length === 0) return null
    return {
      type: 'ctas',
      buildCtas: () => {
        if (typeof step.set_progress === 'number') deps.setProgress(step.set_progress)
        return buttons
      },
    }
  }

  return null
}

function parsePills(raw: JourneyStepDto['pills']): PillOption[] {
  if (!Array.isArray(raw)) return []
  const pills: PillOption[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const label = item.trim()
      if (label) pills.push({ label })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const label = String(item.label ?? '').trim()
    if (!label) continue
    const emoji = String(item.emoji ?? '').trim()
    pills.push(emoji ? { emoji, label } : { label })
  }
  return pills
}

function parseCta(raw: Record<string, unknown>, deps: JourneyDeps): CtaButton | null {
  const label = String(raw.label ?? '').trim()
  const action = String(raw.action ?? '')
  if (!label) return null
  const icon = String(raw.icon ?? '💜').trim() || '💜'
  const style = (['primary', 'secondary', 'accent'] as CtaStyle[]).includes(raw.style as CtaStyle)
    ? (raw.style as CtaStyle)
    : undefined
  const sub = String(raw.subtitle ?? raw.sub ?? '').trim() || undefined
  const journeyNumber = Number(raw.journey_number ?? raw.journeyNumber ?? 0)

  const handler = (() => {
    if (action === 'start_journey' && journeyNumber >= 1) return () => deps.startJourney(journeyNumber)
    if (action === 'map') return () => deps.showScreen('mapScreen')
    if (action === 'plantao') return () => deps.openPsych()
    if (action === 'library') return () => deps.showScreen('journeyScreen')
    if (action === 'profile') return () => deps.showScreen('profileScreen')
    return null
  })()

  if (!handler) return null
  return { icon, label, sub, style, action: handler }
}

export function extrasToHtml(extras?: JourneyExtraDto[]): string | undefined {
  if (!extras?.length) return undefined
  const html = extras
    .map((extra) => {
      if (extra.kind === 'info_card') {
        const items = (extra.items ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')
        return `<div class="info-card"><div class="ic-title">${escapeHtml(extra.title ?? '')}</div><ul>${items}</ul></div>`
      }
      if (extra.kind === 'quote') {
        return `<div class="hquote">${escapeHtml(extra.body ?? '')}</div>`
      }
      if (extra.kind === 'reflection') {
        return `<div class="reflection"><div class="r-title">${escapeHtml(extra.title ?? '')}</div><div class="r-q">${escapeHtml(extra.body ?? '')}</div></div>`
      }
      return ''
    })
    .filter(Boolean)
    .join('')
  return html || undefined
}

export function applyJourneyProfile(
  profile: UserProfile,
  patch: Record<string, unknown> | undefined,
  index: number,
  label: string,
) {
  if (!patch) return

  const stressBy = patch.stress_by_index
  if (Array.isArray(stressBy) && index >= 0 && index < stressBy.length) {
    profile.stressLevel = clamp10(Number(stressBy[index]))
  }
  if (typeof patch.stress === 'number') {
    profile.stressLevel = clamp10(patch.stress)
  }

  const selfcareBy = patch.selfcare_by_index
  if (Array.isArray(selfcareBy) && index >= 0 && index < selfcareBy.length) {
    profile.selfcareLevel = clamp10(Number(selfcareBy[index]))
  }

  const fields = patch.set_fields
  if (fields && typeof fields === 'object') {
    if ('caregiver_role' in fields) profile.caregiverRole = label
    if ('challenge_area' in fields) profile.challengeArea = label
    if ('support_network' in fields) profile.supportNetwork = label
    if ('coping_style' in fields) profile.copingStyle = label
    if ('sleep_quality' in fields) profile.sleepQuality = label
  }

  if (patch.add_emotion) {
    if (!profile.emotionsFound.includes(label)) profile.emotionsFound.push(label)
  }

  const responseType = String(patch.response_type ?? '').trim()
  if (responseType) {
    profile.responses.push({ type: responseType, value: label })
  }
}

function clamp10(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(10, Math.round(value)))
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function journeyHasApiSteps(journey: JourneyItem | undefined) {
  return Boolean(journey?.steps && journey.steps.length > 0)
}
