import type { ChatApi } from '../types/chat'

/** Espera após CTAs/conclusão antes da frase de acompanhamento. */
export const POST_JOURNEY_FOLLOWUP_DELAY_MS = 4_000

const POST_JOURNEY_FOLLOWUPS = [
  {
    html:
      '💚 Você concluiu esta jornada.\n\nEsperamos que este momento tenha sido útil para você. Continue explorando novos conteúdos e jornadas ou, se preferir conversar com um profissional, nosso Plantão Psicológico 24 horas está disponível para acolher você.\n\nAntes de continuar, gostaríamos de saber: como você está se sentindo agora? Se ainda precisar de apoio, conte para nós. Estamos aqui para ouvir e ajudar. 💙',
    audio:
      'Você concluiu esta jornada. Esperamos que este momento tenha sido útil para você. Continue explorando novos conteúdos e jornadas ou, se preferir conversar com um profissional, nosso Plantão Psicológico 24 horas está disponível para acolher você. Antes de continuar, gostaríamos de saber: como você está se sentindo agora? Se ainda precisar de apoio, conte para nós. Estamos aqui para ouvir e ajudar.',
  },
  {
    html:
      '🌱 Parabéns por concluir esta jornada!\n\nO cuidado com a saúde emocional acontece um passo de cada vez. Sempre que desejar, explore novas jornadas e continue contando com a Lia para apoiar você.\n\nSe sentir que precisa de um acolhimento mais imediato, nosso Plantão Psicológico 24 horas está à disposição.\n\nAntes de encerrar, queremos saber: como você está se sentindo agora? Se ainda precisar de ajuda, conte para nós. Estamos aqui para caminhar ao seu lado. 💙',
    audio:
      'Parabéns por concluir esta jornada! O cuidado com a saúde emocional acontece um passo de cada vez. Sempre que desejar, explore novas jornadas e continue contando com a Lia para apoiar você. Se sentir que precisa de um acolhimento mais imediato, nosso Plantão Psicológico 24 horas está à disposição. Antes de encerrar, queremos saber: como você está se sentindo agora? Se ainda precisar de ajuda, conte para nós. Estamos aqui para caminhar ao seu lado.',
  },
  {
    html:
      '🌱 Parabéns por concluir esta jornada! O cuidado com a saúde emocional acontece um passo de cada vez. Sempre que desejar, explore novas jornadas, converse com a Lia ou, se precisar de um acolhimento imediato, acesse o Plantão Psicológico 24 horas. Estamos aqui para caminhar com você. 💙',
    audio:
      'Parabéns por concluir esta jornada! O cuidado com a saúde emocional acontece um passo de cada vez. Sempre que desejar, explore novas jornadas, converse com a Lia ou, se precisar de um acolhimento imediato, acesse o Plantão Psicológico 24 horas. Estamos aqui para caminhar com você.',
  },
] as const

function pickRandomFollowUp() {
  const index = Math.floor(Math.random() * POST_JOURNEY_FOLLOWUPS.length)
  return POST_JOURNEY_FOLLOWUPS[index]
}

let followUpTimer: ReturnType<typeof setTimeout> | null = null

export function cancelPostJourneyFollowUp(): void {
  if (followUpTimer == null) return
  clearTimeout(followUpTimer)
  followUpTimer = null
}

/** Mensagem padrão aleatória alguns segundos após concluir uma jornada. */
export function schedulePostJourneyFollowUp(api: ChatApi): void {
  cancelPostJourneyFollowUp()
  const followUp = pickRandomFollowUp()
  followUpTimer = setTimeout(() => {
    followUpTimer = null
    api.showTyping(() => {
      api.addAiMsg(followUp.html, followUp.audio)
    }, 1_200)
  }, POST_JOURNEY_FOLLOWUP_DELAY_MS)
}
