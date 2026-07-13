import type { ChatApi, JourneyQuestion } from '../types/chat'
import { getJourneyByNumber } from '../data/journeys'
import { isAiChatEnabled, sendJourneyStep } from '../services/liaApi'
import { prepareSpeechFromResponse } from '../services/chatSpeech'

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
      onComplete()
    })
  }

  const acknowledgeOpenAnswer = (question: JourneyQuestion, answer: string) => {
    if (isAiChatEnabled()) {
      api.runWithTyping(async () => {
        try {
          const response = await sendJourneyStep({
            journeyNumber,
            journeyTitle,
            stepIndex: question.sort_order,
            instruction: `Pergunta da jornada: "${stripHtml(question.prompt)}". Resposta do cuidador: "${answer}". Acolha em 2 a 4 frases, sem julgar. Não abra novas perguntas longas.`,
            userChoice: answer,
            profile: api.getProfile(),
            history: api.getChatHistory(),
            includeSpeech: api.isAudioEnabled(),
          })
          api.addAiMsg(
            response.reply,
            response.audioText,
            undefined,
            prepareSpeechFromResponse(response),
          )
        } catch {
          api.addAiMsg(
            'Obrigada por compartilhar isso comigo. Sua resposta faz sentido no seu contexto. 💙',
            'Obrigada por compartilhar isso comigo. Sua resposta faz sentido no seu contexto.',
          )
        }
        setTimeout(() => runNext(), 500)
      })
      return
    }

    api.showTyping(() => {
      api.addAiMsg(
        'Obrigada por compartilhar isso comigo. Sua resposta faz sentido no seu contexto. 💙',
        'Obrigada por compartilhar isso comigo. Sua resposta faz sentido no seu contexto.',
      )
      setTimeout(() => runNext(), 500)
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

  const runNext = () => {
    if (!active) return

    if (stepIndex >= questions.length) {
      finish()
      return
    }

    const question = questions[stepIndex]
    stepIndex += 1
    currentQuestion = question

    if (question.type === 'multiple_choice') {
      const options = (question.options ?? []).filter(Boolean)
      if (options.length < 2) {
        runNext()
        return
      }

      waitingOpen = false
      api.showTyping(() => {
        api.addPicker(
          promptToHtml(question.prompt),
          stripHtml(question.prompt),
          options.map((label) => ({ label })),
          (_idx, label) => {
            recordAnswer(question, label)
            currentQuestion = null
            runNext()
          },
        )
      })
      return
    }

    waitingOpen = true
    api.showTyping(() => {
      api.addAiMsg(promptToHtml(question.prompt), stripHtml(question.prompt))
    })
  }

  const handleUserMessage = (text: string): boolean => {
    if (!active || !waitingOpen || !currentQuestion) return false

    const answer = text.trim()
    if (!answer) return true

    waitingOpen = false
    recordAnswer(currentQuestion, answer)
    const answered = currentQuestion
    currentQuestion = null
    acknowledgeOpenAnswer(answered, answer)
    return true
  }

  api.showTyping(() => {
    api.addAiMsg(
      `Vamos iniciar a <strong>${escapeHtml(journeyTitle)}</strong>.\n\nResponda no seu ritmo — não há respostas certas ou erradas. 💜`,
      `Vamos iniciar a ${journeyTitle}. Responda no seu ritmo. Não há respostas certas ou erradas.`,
    )
    setTimeout(() => runNext(), 1000)
  })

  return {
    handleUserMessage,
    isActive: () => active,
    cancel,
  }
}
