export const OPEN_MOOD_PROMPT = {
  html: `Antes de mais nada, me conte com calma: <strong>como você está se sentindo hoje?</strong><br><br>Não precisa resumir em uma palavra — pode falar do corpo, da mente, do cansaço ou do que estiver pesando. Estou aqui para ouvir, sem julgamento.`,
  audio:
    'Antes de mais nada, me conte com calma como você está se sentindo hoje. Não precisa resumir em uma palavra. Pode falar do corpo, da mente, do cansaço ou do que estiver pesando. Estou aqui para ouvir, sem julgamento.',
}

export const OPEN_REPLY_HINT =
  'Pode responder com calma e com o nível de detalhe que fizer sentido para você — estou aqui para ouvir.'

export function isMoodQuestion(question: string): boolean {
  return /como você está se sentindo|como está se sentindo/i.test(question.replace(/<[^>]+>/g, ''))
}
