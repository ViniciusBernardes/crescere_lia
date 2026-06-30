export const MOOD_KEYS = [
  'No limite',
  'Cansado(a)',
  'Confuso(a)',
  'Estou bem',
  'Não sei dizer',
] as const

export type MoodKey = (typeof MOOD_KEYS)[number]

export const MOOD_CONFIG: Record<
  MoodKey,
  { text: string; audio: string; stress: number; sc: number; journey: number }
> = {
  'No limite': {
    text: 'Quando você está no limite, seu corpo e sua mente estão pedindo pausa, não cobrança.\n\nAqui, o cuidado começa com você. Vamos respirar juntos. 💙',
    audio: 'Quando você está no limite, seu corpo e sua mente estão pedindo pausa. Aqui, o cuidado começa com você.',
    stress: 8,
    sc: 2,
    journey: 9,
  },
  'Cansado(a)': {
    text: 'O cansaço é um sinal de amor prolongado sem descanso suficiente.\n\nVocê não está fraco(a) — está sobrecarregado(a). Aqui, isso tem espaço. 🌿',
    audio: 'O cansaço é um sinal de amor prolongado sem descanso suficiente. Você não está fraco, está sobrecarregado.',
    stress: 6,
    sc: 3,
    journey: 5,
  },
  'Confuso(a)': {
    text: 'A confusão é comum quando a informação é demais e o apoio é de menos.\n\nVamos organizar tudo em passos simples, sem pressa. 📚',
    audio: 'A confusão é comum quando a informação é demais e o apoio é de menos. Vamos organizar tudo em passos simples.',
    stress: 5,
    sc: 4,
    journey: 2,
  },
  'Estou bem': {
    text: 'Que bom! 🙂 Mesmo nos dias bons, o cuidado preventivo fortalece você para os dias difíceis.\n\nVamos explorar juntos?',
    audio: 'Que bom! Mesmo nos dias bons, o cuidado preventivo fortalece você para os dias difíceis.',
    stress: 2,
    sc: 7,
    journey: 2,
  },
  'Não sei dizer': {
    text: 'Às vezes é difícil nomear o que sentimos. Isso também é um sinal importante.\n\nVamos começar com uma checagem para entender melhor o seu momento. 💭',
    audio: 'Às vezes é difícil nomear o que sentimos. Isso também é um sinal importante. Vamos começar com uma checagem para entender melhor seu momento.',
    stress: 4,
    sc: 4,
    journey: 4,
  },
}

export const MOOD_PILLS = [
  { emoji: '😔', label: 'No limite' },
  { emoji: '🫥', label: 'Cansado(a)' },
  { emoji: '🤔', label: 'Confuso(a)' },
  { emoji: '🙂', label: 'Estou bem' },
  { emoji: '❓', label: 'Não sei dizer' },
] as const

export function resolveMoodKey(label: string): MoodKey {
  const key = MOOD_KEYS.find((k) => label.includes(k))
  return key || 'Não sei dizer'
}
