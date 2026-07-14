import type { ChatApi } from '../types/chat'
import { getJourneyByNumber } from '../data/journeys'
import { isAiChatEnabled, sendJourneyStep } from '../services/liaApi'
import { prepareSpeechFromResponse } from '../services/chatSpeech'
import { buildJourneySteps, type JourneyDeps } from './journeyAiSteps'
import { schedulePostJourneyFollowUp } from './postJourneyFollowUp'

export type AiJourneyController = {
  handleUserMessage: (text: string) => boolean
  isActive: () => boolean
  cancel: () => void
}

function fillInstruction(template: string, choice: string) {
  return template.replace(/\{choice\}/g, choice)
}

async function requestAiStep(
  api: ChatApi,
  journeyNumber: number,
  journeyTitle: string,
  stepIndex: number,
  instruction: string,
  userChoice?: string,
) {
  const history = api.getChatHistory()
  return sendJourneyStep({
    journeyNumber,
    journeyTitle,
    stepIndex,
    instruction,
    userChoice,
    profile: api.getProfile(),
    history,
    includeSpeech: api.isAudioEnabled(),
  })
}

export function startAiJourney(
  api: ChatApi,
  journeyNumber: number,
  startJourney: (n: number) => void,
): AiJourneyController {
  if (!isAiChatEnabled()) {
    return {
      handleUserMessage: () => false,
      isActive: () => false,
      cancel: () => undefined,
    }
  }

  let active = true
  let waitingContinue = false
  let pendingAdvance: (() => void) | null = null

  const deps: JourneyDeps = {
    startJourney,
    openPsych: () => api.openPsych(),
    showScreen: (id) => api.showScreen(id),
    setProgress: (pct) => api.setProgress(pct),
  }

  const steps = buildJourneySteps(deps)[journeyNumber] ?? []
  const journey = getJourneyByNumber(journeyNumber)
  const journeyTitle = journey?.title || `Jornada ${journeyNumber}`

  const cancel = () => {
    active = false
    waitingContinue = false
    pendingAdvance = null
  }

  const waitForUserThen = (next: () => void) => {
    if (!active) return
    waitingContinue = true
    pendingAdvance = next
  }

  const runFrom = (fromIndex: number) => {
    if (!active) return
    if (fromIndex >= steps.length) {
      active = false
      return
    }

    const step = steps[fromIndex]
    const advance = () => runFrom(fromIndex + 1)

    if (step.type === 'ai') {
      api.runWithTyping(async () => {
        if (!active) return
        try {
          const response = await requestAiStep(
            api,
            journeyNumber,
            journeyTitle,
            fromIndex,
            step.instruction,
          )
          api.addAiMsg(
            response.reply,
            response.audioText,
            step.extras,
            prepareSpeechFromResponse(response),
          )
        } catch {
          if (step.fallbackHtml) {
            api.addAiMsg(step.fallbackHtml, step.fallbackAudio || step.fallbackHtml, step.extras)
          } else {
            api.addAiMsg(
              'Desculpe, tive uma dificuldade agora. Quando quiser, me responde com qualquer mensagem para seguirmos. 💙',
              'Desculpe, tive uma dificuldade agora. Quando quiser, me responde para seguirmos.',
            )
          }
        }
        waitForUserThen(advance)
      })
      return
    }

    if (step.type === 'picker') {
      api.showTyping(() => {
        if (!active) return
        api.addPicker(
          step.question,
          step.audioQ,
          step.pills,
          (idx, label) => {
            if (!active) return
            const profile = api.getProfile()
            step.onPick?.(profile, idx, label)
            api.updateMap()

            api.runWithTyping(async () => {
              if (!active) return
              try {
                const instruction = fillInstruction(step.pickInstruction, label)
                const response = await requestAiStep(
                  api,
                  journeyNumber,
                  journeyTitle,
                  fromIndex,
                  instruction,
                  label,
                )
                api.addAiMsg(
                  response.reply,
                  response.audioText,
                  step.extras,
                  prepareSpeechFromResponse(response),
                )
              } catch {
                api.addAiMsg(
                  'Obrigada por compartilhar isso comigo. Sua resposta faz sentido no seu contexto. 💙',
                  'Obrigada por compartilhar isso comigo. Sua resposta faz sentido no seu contexto.',
                  step.extras,
                )
              }
              waitForUserThen(advance)
            })
          },
          { forcePills: true },
        )
      })
      return
    }

    if (step.type === 'ctas') {
      api.addCtas(step.buildCtas(deps))
      active = false
      schedulePostJourneyFollowUp(api)
    }
  }

  const handleUserMessage = (text: string): boolean => {
    if (!active || !waitingContinue) return false
    const answer = text.trim()
    if (!answer) return true

    waitingContinue = false
    const next = pendingAdvance
    pendingAdvance = null
    next?.()
    return true
  }

  if (steps.length === 0) {
    return { handleUserMessage, isActive: () => false, cancel }
  }

  runFrom(0)

  return {
    handleUserMessage,
    isActive: () => active,
    cancel,
  }
}

/** @deprecated use startAiJourney */
export function runAiJourney(api: ChatApi, journeyNumber: number, startJourney: (n: number) => void) {
  startAiJourney(api, journeyNumber, startJourney)
}
