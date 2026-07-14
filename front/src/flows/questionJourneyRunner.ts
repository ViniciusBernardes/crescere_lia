import type { ChatApi, JourneyQuestion } from '../types/chat'
import { getJourneyByNumber } from '../data/journeys'
import { schedulePostJourneyFollowUp } from './postJourneyFollowUp'

export type QuestionJourneyController = {
  handleUserMessage: (text: string) => boolean
  isActive: () => boolean
  cancel: () => void
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function promptToHtml(prompt: string): string {
  return escapeHtml(prompt).replace(/\n/g, '<br>')
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '')
}

export function startQuestionJourney(
  api: ChatApi,
  journeyNumber: number,
  questions: JourneyQuestion[],
  onComplete: () => void,
): QuestionJourneyController {
  let active = true
  let waitingOpen = false
  let currentQuestion: JourneyQuestion | null = null
  let stepIndex = 0

  const journey = getJourneyByNumber(journeyNumber)
  const journeyTitle = journey?.title ?? `Jornada ${journeyNumber}`

  const cancel = () => {
    active = false
    waitingOpen = false
    currentQuestion = null
  }

  const finish = () => {
    if (!active) return
    cancel()
    api.showTyping(() => {
      api.addAiMsg(
        `<strong>Jornada ${journeyNumber} concluída!</strong> 💜\n\nObrigada por dedicar este tempo a você. Cada passo conta.`,
        `Jornada ${journeyNumber} concluída! Obrigada por dedicar este tempo a você.`,
      )
      api.addCtas([
        {
          icon: '📊',
          label: 'Ver meu mapa',
          style: 'primary',
          action: () => api.showScreen('mapScreen'),
        },
        {
          icon: '🗺️',
          label: 'Ver outras jornadas',
          style: 'secondary',
          action: () => api.showScreen('journeyScreen'),
        },
        {
          icon: '💜',
          label: 'Falar com psicólogo',
          style: 'accent',
          action: () => api.openPsych(),
        },
      ])
      schedulePostJourneyFollowUp(api)
      onComplete()
    })
  }

  const recordAnswer = (question: JourneyQuestion, answer: string) => {
    const profile = api.getProfile()
    profile.responses.push({
      type: `j${journeyNumber}_q${question.sort_order}`,
      value: answer,
      time: Date.now(),
    })
    api.updateMap()
  }

  const presentOpen = (question: JourneyQuestion, html: string, audio: string) => {
    currentQuestion = question
    waitingOpen = true
    api.showTyping(() => {
      api.addAiMsg(html, audio)
    })
  }

  const presentMultipleChoice = (
    question: JourneyQuestion,
    html: string,
    audio: string,
    advanceWithAck: boolean,
  ) => {
    const options = (question.options ?? []).filter(Boolean)
    if (options.length < 2) {
      runNext(advanceWithAck)
      return
    }

    currentQuestion = question
    waitingOpen = false
    api.showTyping(() => {
      api.addPicker(
        html,
        audio,
        options.map((label) => ({ label })),
        (_idx, label) => {
          recordAnswer(question, label)
          currentQuestion = null
          api.showTyping(() => runNext(true), 700)
        },
        { forcePills: true },
      )
    }, advanceWithAck ? 600 : 900)
  }

  const runNext = (withAck = false) => {
    if (!active) return

    if (stepIndex >= questions.length) {
      finish()
      return
    }

    const question = questions[stepIndex]
    stepIndex += 1

    if (withAck) {
      const html = `Obrigada por compartilhar. 💙<br><br>${promptToHtml(question.prompt)}`
      const audio = `Obrigada por compartilhar. ${stripHtml(question.prompt)}`
      if (question.type === 'multiple_choice') {
        presentMultipleChoice(question, html, audio, true)
      } else {
        presentOpen(question, html, audio)
      }
      return
    }

    if (question.type === 'multiple_choice') {
      presentMultipleChoice(question, promptToHtml(question.prompt), stripHtml(question.prompt), false)
    } else {
      presentOpen(question, promptToHtml(question.prompt), stripHtml(question.prompt))
    }
  }

  const handleUserMessage = (text: string): boolean => {
    if (!active || !waitingOpen || !currentQuestion) return false

    const answer = text.trim()
    if (!answer) return true

    waitingOpen = false
    recordAnswer(currentQuestion, answer)
    currentQuestion = null
    runNext(true)
    return true
  }

  if (questions.length === 0) {
    finish()
    return { handleUserMessage, isActive: () => active, cancel }
  }

  // Intro + 1ª pergunta na mesma bolha (uma única conversa)
  const first = questions[0]
  stepIndex = 1
  const introHtml = `Vamos iniciar a <strong>${escapeHtml(journeyTitle)}</strong>. Responda no seu ritmo — não há respostas certas ou erradas. 💜<br><br>${promptToHtml(first.prompt)}`
  const introAudio = `Vamos iniciar a ${journeyTitle}. Responda no seu ritmo. ${stripHtml(first.prompt)}`

  if (first.type === 'multiple_choice') {
    presentMultipleChoice(first, introHtml, introAudio, false)
  } else {
    presentOpen(first, introHtml, introAudio)
  }

  return {
    handleUserMessage,
    isActive: () => active,
    cancel,
  }
}
