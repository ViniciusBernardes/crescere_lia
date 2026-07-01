import type { ChatApi } from '../types/chat'
import { JOURNEYS } from '../data/journeys'
import { MOOD_CONFIG, MOOD_PILLS, resolveMoodKey } from '../data/moodConfig'
import { isAiChatEnabled, sendJourneyStep } from '../services/liaApi'
import { prepareSpeechFromResponse } from '../services/chatSpeech'

const INTRO_TITLE = 'Introdução — Primeiro contato'

const WELCOME_INSTRUCTION =
  'Dê as boas-vindas calorosas ao cuidador que acabou de entrar no Crescere. Diga que este espaço foi criado para ele(a), que estar aqui já é um gesto de cuidado consigo. Tom acolhedor, sem pressa, 2–3 parágrafos curtos. Pode usar 💜 no final.'

const WELCOME_FALLBACK = {
  html: 'Olá! Que coisa boa contar com a sua presença aqui! 💜\n\nSe você está aqui, é porque uma parte sua também pediu atenção. Este espaço foi criado para você.',
  audio:
    'Olá! Que coisa boa contar com a sua presença aqui! Se você está aqui, é porque uma parte sua também pediu atenção. Este espaço foi criado para você.',
}

function moodPickInstruction(label: string, moodKey: string): string {
  const hints: Record<string, string> = {
    'No limite':
      'Valide que o limite é real. O corpo pede pausa, não cobrança. Tom calmo e presente. Se fizer sentido, mencione que há jornadas sobre crise e autocuidado.',
    'Cansado(a)':
      'Valide o cansaço como sinal de amor prolongado sem descanso. Não é fraqueza, é sobrecarga. Tom gentil.',
    'Confuso(a)':
      'Valide a confusão quando há informação demais e apoio de menos. Ofereça organizar em passos simples, sem pressa.',
    'Estou bem':
      'Celebre com leveza. Mesmo nos dias bons, cuidado preventivo fortalece. Convide a explorar sem pressão.',
    'Não sei dizer':
      'Valide a dificuldade de nomear sentimentos. Isso também é informação importante. Convide a uma checagem gentil do momento.',
  }

  return `O cuidador escolheu como se sente hoje: "${label}" (${moodKey}). ${hints[moodKey] || hints['Não sei dizer']} Personalize com empatia. Não sugira jornada específica no texto — isso virá depois.`
}

export function runAiIntro(api: ChatApi) {
  if (!isAiChatEnabled()) return

  api.setProgress(5)

  api.runWithTyping(async () => {
    try {
      const response = await sendJourneyStep({
        journeyNumber: 0,
        journeyTitle: INTRO_TITLE,
        stepIndex: 0,
        instruction: WELCOME_INSTRUCTION,
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
      api.addAiMsg(WELCOME_FALLBACK.html, WELCOME_FALLBACK.audio)
    }

    api.addPicker(
      'Como você está se sentindo <strong>hoje</strong>?',
      'Como você está se sentindo hoje?',
      [...MOOD_PILLS],
      (_idx, label) => {
        const moodKey = resolveMoodKey(label)
        const mood = MOOD_CONFIG[moodKey]
        const profile = api.getProfile()

        profile.emotionToday = moodKey
        profile.stressLevel = mood.stress
        profile.selfcareLevel = mood.sc
        profile.responses.push({ type: 'mood', value: moodKey })
        api.updateMap()
        api.setProgress(15)

        api.runWithTyping(async () => {
          try {
            const response = await sendJourneyStep({
              journeyNumber: 0,
              journeyTitle: INTRO_TITLE,
              stepIndex: 1,
              instruction: moodPickInstruction(label, moodKey),
              userChoice: label,
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
            api.addAiMsg(mood.text, mood.audio)
          }

          const suggested = JOURNEYS.find((j) => j.n === mood.journey) || JOURNEYS[0]
          api.suggestBlock(suggested)
        })
      },
    )
  })
}
