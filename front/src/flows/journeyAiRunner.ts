import type { ChatApi } from '../types/chat'
import { JOURNEYS } from '../data/journeys'
import { isAiChatEnabled, sendJourneyStep } from '../services/liaApi'
import { prepareSpeechFromResponse } from '../services/chatSpeech'
import { buildJourneySteps, type JourneyDeps, type JourneyStep } from './journeyAiSteps'

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

function runAiStep(
  api: ChatApi,
  journeyNumber: number,
  journeyTitle: string,
  stepIndex: number,
  step: Extract<JourneyStep, { type: 'ai' }>,
  onDone: () => void,
) {
  api.runWithTyping(async () => {
    try {
      const response = await requestAiStep(
        api,
        journeyNumber,
        journeyTitle,
        stepIndex,
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
          'Desculpe, tive uma dificuldade agora. Vamos continuar — você pode tentar de novo em instantes. 💙',
          'Desculpe, tive uma dificuldade agora. Vamos continuar.',
        )
      }
    }
    onDone()
  })
}

function runPickerStep(
  api: ChatApi,
  journeyNumber: number,
  journeyTitle: string,
  stepIndex: number,
  step: Extract<JourneyStep, { type: 'picker' }>,
  onDone: () => void,
) {
  api.addPicker(step.question, step.audioQ, step.pills, (idx, label) => {
    const profile = api.getProfile()
    step.onPick?.(profile, idx, label)
    api.updateMap()

    api.runWithTyping(async () => {
      try {
        const instruction = fillInstruction(step.pickInstruction, label)
        const response = await requestAiStep(
          api,
          journeyNumber,
          journeyTitle,
          stepIndex,
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
      onDone()
    })
  })
}

function runSteps(
  api: ChatApi,
  journeyNumber: number,
  steps: JourneyStep[],
  deps: JourneyDeps,
  fromIndex = 0,
) {
  if (fromIndex >= steps.length) return

  const journey = JOURNEYS.find((j) => j.n === journeyNumber)
  const journeyTitle = journey?.title || `Jornada ${journeyNumber}`
  const step = steps[fromIndex]

  const advance = () => runSteps(api, journeyNumber, steps, deps, fromIndex + 1)

  if (step.type === 'ai') {
    runAiStep(api, journeyNumber, journeyTitle, fromIndex, step, advance)
    return
  }

  if (step.type === 'picker') {
    runPickerStep(api, journeyNumber, journeyTitle, fromIndex, step, advance)
    return
  }

  if (step.type === 'ctas') {
    api.addCtas(step.buildCtas(deps))
  }
}

export function runAiJourney(api: ChatApi, journeyNumber: number, startJourney: (n: number) => void) {
  if (!isAiChatEnabled()) return

  const deps: JourneyDeps = {
    startJourney,
    openPsych: () => api.openPsych(),
    showScreen: (id) => api.showScreen(id),
    setProgress: (pct) => api.setProgress(pct),
  }

  const allSteps = buildJourneySteps(deps)
  const steps = allSteps[journeyNumber]
  if (!steps?.length) return

  runSteps(api, journeyNumber, steps, deps)
}
