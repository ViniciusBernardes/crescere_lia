// @ts-nocheck
import type { CtaButton, PillOption } from '../types/chat'
import type { UserProfile } from '../types/profile'

export type AiStep = {
  type: 'ai'
  instruction: string
  fallbackHtml?: string
  fallbackAudio?: string
  extras?: string
}

export type PickerStep = {
  type: 'picker'
  question: string
  audioQ: string
  pills: PillOption[]
  pickInstruction: string
  extras?: string
  onPick?: (profile: UserProfile, idx: number, label: string) => void
}

export type CtasStep = {
  type: 'ctas'
  buildCtas: (deps: JourneyDeps) => CtaButton[]
}

export type JourneyStep = AiStep | PickerStep | CtasStep

export type JourneyDeps = {
  startJourney: (n: number) => void
  openPsych: () => void
  showScreen: (id: string) => void
  setProgress: (pct: number) => void
}

export function buildJourneySteps(deps: JourneyDeps): Record<number, JourneyStep[]> {
  const { startJourney, openPsych, showScreen, setProgress } = deps

  return {
    1: [
      {
        type: 'ai',
        instruction:
          'Dê boas-vindas calorosas à Jornada 1 — Acolhimento e Chegada. Fale sobre o significado de estar aqui: não é acaso, é um gesto de quem percebeu que seguir sozinho estava pesado. Valide a chegada sem pressa.',
        fallbackHtml:
          'Olá! Que coisa boa contar com a tua presença aqui!\n\nAntes de qualquer explicação, eu quero falar sobre <strong>estar aqui</strong>.\n\nEstar aqui não é um acaso. É um gesto silencioso de quem percebeu que seguir sozinho estava pesado demais.',
      },
      {
        type: 'ai',
        instruction:
          'Explique com empatia o contraste entre modo sobrevivência e modo cuidado no cérebro de quem cuida sob pressão prolongada. Use um bloco info-card listando sinais de cada modo. Seja acolhedor, sem jargão excessivo.',
        extras:
          '<div class="info-card"><div class="ic-title">⚡ Modo sobrevivência</div><ul><li>Pensamento acelerado ou confuso</li><li>Emoções intensas ou anestesiadas</li><li>Corpo tenso e exausto</li></ul></div>',
      },
      {
        type: 'picker',
        question: 'Perceba agora, sem se julgar:\n\n👉 Nos últimos dias, você tem se sentido mais:',
        audioQ: 'Perceba agora, sem se julgar. Nos últimos dias, você tem se sentido mais:',
        pills: [
          { emoji: '🔥', label: 'Sempre em alerta' },
          { emoji: '🪫', label: 'Exausto mesmo descansando' },
          { emoji: '🌫️', label: 'Confuso e sobrecarregado' },
          { emoji: '🌱', label: 'Algo começou a aliviar' },
        ],
        pickInstruction:
          'O cuidador escolheu "{choice}". Valide essa percepção como um passo fora do modo sobrevivência. Diga que aqui não precisa provar nada nem ser forte o tempo todo.',
        onPick: (p, idx, label) => {
          p.stressLevel = [8, 7, 6, 3][idx] || 5
          p.responses.push({ type: 'j1_state', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Convide o cuidador a olhar para si: o papel de cuidador pode ocupar todos os espaços até a pessoa ficar invisível. Inclua a frase de impacto: cuidadores não adoecem por serem fracos, adoecem por ficarem fortes por tempo demais.',
        extras: '<div class="hquote">Cuidadores não adoecem porque são fracos. Eles adoecem porque permanecem fortes por tempo demais.</div>',
      },
      {
        type: 'picker',
        question: '👉 Nos últimos tempos, como você tem se colocado na própria vida?',
        audioQ: 'Nos últimos tempos, como você tem se colocado na própria vida?',
        pills: [
          { emoji: '🫥', label: 'Tenho me sentido invisível' },
          { emoji: '⚖️', label: 'Tento equilibrar' },
          { emoji: '😔', label: 'Sinto culpa quando penso em mim' },
          { emoji: '🌱', label: 'Preciso cuidar mais de mim' },
          { emoji: '🤍', label: 'Consigo às vezes' },
        ],
        pickInstruction:
          'O cuidador disse: "{choice}". Responda com empatia profunda e personalizada a essa experiência. Valide sem julgar. Mostre que cuidar de si não diminui o cuidado com o outro.',
        onPick: (p, idx, label) => {
          p.caregiverRole = label
          p.selfcareLevel = [2, 4, 3, 5, 6][idx] || 3
          p.responses.push({ type: 'caregiver_role', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Fale sobre normalizar sentimentos difíceis no cuidado — tristeza, irritação, medo, vazio. Diga que sentir não invalida o amor. Inclua reflexão gentil sobre o que esses sentimentos podem estar pedindo.',
      },
      {
        type: 'picker',
        question: '👉 Nos últimos tempos, quais sentimentos têm aparecido com mais frequência?',
        audioQ: 'Nos últimos tempos, quais sentimentos têm aparecido com mais frequência?',
        pills: [
          { emoji: '😔', label: 'Tristeza ou desânimo' },
          { emoji: '😤', label: 'Irritação ou raiva' },
          { emoji: '😟', label: 'Medo de errar' },
          { emoji: '😶', label: 'Sensação de vazio' },
          { emoji: '🤍', label: 'Amor com muito cansaço' },
          { emoji: '❓', label: 'Não sei identificar' },
        ],
        pickInstruction:
          'O cuidador marcou o sentimento: "{choice}". Valide que faz sentido na história dele(a). Nenhum sentimento invalida o amor ou a dedicação. Feche celebrando a conclusão da Jornada 1.',
        onPick: (p, _idx, label) => {
          p.emotionsFound.push(label)
          p.responses.push({ type: 'emotions', value: label })
        },
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 2', style: 'primary', action: () => startJourney(2) },
          { icon: '📊', label: 'Ver meu mapa emocional', style: 'secondary', action: () => showScreen('mapScreen') },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    2: [
      {
        type: 'ai',
        instruction:
          'Inicie a Jornada 2 — Compreendendo o TEA. Explique que TEA não é doença, é condição do neurodesenvolvimento. Conhecimento acolhe. Use info-card com pontos essenciais (não é causado por falta de afeto, não há cura mas há suporte).',
      },
      {
        type: 'ai',
        instruction:
          'Explique o conceito de espectro e as três áreas: comunicação/interação, comportamentos/rotinas, processamento sensorial. Use info-cards breves para cada área.',
      },
      {
        type: 'picker',
        question: 'Ao pensar na criança com TEA, em qual área você percebe <strong>mais desafios</strong> no dia a dia?',
        audioQ: 'Em qual área você percebe mais desafios no dia a dia?',
        pills: [
          { emoji: '💬', label: 'Comunicação e interação' },
          { emoji: '🔄', label: 'Rotinas e comportamentos' },
          { emoji: '👂', label: 'Sensibilidade sensorial' },
        ],
        pickInstruction:
          'O cuidador indicou maior desafio em: "{choice}". Valide os desafios reais e diga que buscar entender é um passo essencial. Mencione que outras jornadas trarão estratégias práticas.',
        onPick: (p, _idx, label) => {
          p.challengeArea = label
          p.responses.push({ type: 'challenge_area', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Apresente o conceito de neurodiversidade de forma acolhedora: diferença não é déficit. Convide o cuidador a refletir como se sentiu ao aprender isso.',
      },
      {
        type: 'picker',
        question: 'Como você se sentiu ao ler sobre neurodiversidade?',
        audioQ: 'Como você se sentiu ao ler sobre neurodiversidade?',
        pills: [
          { emoji: '🌱', label: 'Mais esperançoso(a)' },
          { emoji: '🤔', label: 'Ainda confuso(a)' },
          { emoji: '😌', label: 'Aliviado(a)' },
          { emoji: '😟', label: 'Preocupado(a) com o futuro' },
        ],
        pickInstruction:
          'O cuidador sentiu: "{choice}". Acolha essa emoção. Feche a Jornada 2 dizendo que conhecimento empodera e reduz medo. Celebre a conclusão.',
        onPick: (p, _idx, label) => {
          p.responses.push({ type: 'j2_feeling', value: label })
        },
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 3', style: 'primary', action: () => startJourney(3) },
          { icon: '📊', label: 'Ver meu mapa', style: 'secondary', action: () => showScreen('mapScreen') },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    3: [
      {
        type: 'ai',
        instruction:
          'Jornada 3 — Sentimentos diante do diagnóstico. Valide que o diagnóstico atravessa quem cuida: amor, medo, luto, esperança, exaustão — nenhuma emoção é errada. Mencione luto simbólico das expectativas.',
      },
      {
        type: 'picker',
        question: 'Marque o que você já sentiu desde o diagnóstico:',
        audioQ: 'Marque o que você já sentiu desde o diagnóstico:',
        pills: [
          { emoji: '😢', label: 'Tristeza ou luto' },
          { emoji: '😰', label: 'Medo do futuro' },
          { emoji: '😤', label: 'Raiva ou revolta' },
          { emoji: '😔', label: 'Culpa' },
          { emoji: '🌱', label: 'Esperança' },
          { emoji: '🤍', label: 'Todas essas emoções' },
        ],
        pickInstruction:
          'O cuidador marcou: "{choice}". Acolha profundamente. Diga que essa história merece espaço. Fale sobre culpa parental — autismo não é causado por ações dos pais.',
        onPick: (p, _idx, label) => {
          p.responses.push({ type: 'diagnosis_feelings', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Feche a Jornada 3 celebrando o passo corajoso de explorar sentimentos. Se emoções difíceis surgiram, mencione Jornada 5 (Cuidar de Si) e plantão psicológico como recursos.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 4', style: 'primary', action: () => startJourney(4) },
          { icon: '🌱', label: 'Jornada 5 — Cuidar de Si', style: 'secondary', action: () => startJourney(5) },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    4: [
      {
        type: 'ai',
        instruction:
          'Jornada 4 — Autoavaliação. Convide o cuidador a se ver com clareza, sem julgamento. É uma checagem emocional gentil.',
      },
      {
        type: 'picker',
        question: 'Quando você pensa na sua vida hoje, você sente que:',
        audioQ: 'Quando você pensa na sua vida hoje, você sente que:',
        pills: [
          { emoji: '🌊', label: 'Estou sobrecarregado(a)' },
          { emoji: '⚖️', label: 'Consigo equilibrar, mas com esforço' },
          { emoji: '🌱', label: 'Estou encontrando meu ritmo' },
          { emoji: '😶', label: 'Nem sei mais como estou' },
          { emoji: '🤍', label: 'Estou bem hoje' },
        ],
        pickInstruction:
          'O cuidador disse: "{choice}". Responda com feedback empático e personalizado sobre esse estado. Sem cobrança.',
        onPick: (p, idx, label) => {
          p.stressLevel = [8, 6, 4, 7, 2][idx] || 5
          p.responses.push({ type: 'life_perception', value: label })
        },
      },
      {
        type: 'picker',
        question: 'Nos últimos dias, você tem notado em você:',
        audioQ: 'Nos últimos dias, você tem notado em você:',
        pills: [
          { emoji: '😴', label: 'Sono ruim ou insônia' },
          { emoji: '🍽️', label: 'Mudanças no apetite' },
          { emoji: '😤', label: 'Irritação fácil' },
          { emoji: '😶', label: 'Sensação de estar no automático' },
          { emoji: '💪', label: 'Nenhum desses' },
        ],
        pickInstruction:
          'O cuidador notou: "{choice}". Explique que esses sinais são alertas do corpo e mente, não fraqueza.',
        onPick: (p, _idx, label) => {
          p.responses.push({ type: 'body_signals', value: label })
        },
      },
      {
        type: 'picker',
        question: 'Como anda o seu autocuidado nos últimos tempos?',
        audioQ: 'Como anda o seu autocuidado nos últimos tempos?',
        pills: [
          { emoji: '✅', label: 'Consigo me cuidar razoavelmente' },
          { emoji: '⚠️', label: 'Me cuido pouco, mas tento' },
          { emoji: '❌', label: 'Praticamente não me cuido' },
          { emoji: '🤷', label: 'Nem sei mais o que seria me cuidar' },
        ],
        pickInstruction:
          'Sobre autocuidado, o cuidador disse: "{choice}". Responda com gentileza e feche a Jornada 4 celebrando a honestidade dessa avaliação.',
        onPick: (p, idx, label) => {
          p.selfcareLevel = [7, 4, 2, 3][idx] || 3
          p.responses.push({ type: 'selfcare_level', value: label })
        },
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 5', style: 'primary', action: () => startJourney(5) },
          { icon: '📊', label: 'Ver meu mapa', style: 'secondary', action: () => showScreen('mapScreen') },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    5: [
      {
        type: 'ai',
        instruction:
          'Jornada 5 — Cuidar de Si. Autocuidado não é egoísmo, é sustentação. Cuidar de si sustenta o cuidado com o outro. Desmistifique autocuidado idealizado — pequenos gestos na rotina contam.',
        extras:
          '<div class="info-card"><div class="ic-title">🌿 Autocuidado possível</div><ul><li>5 minutos de silêncio</li><li>Uma caminhada curta</li><li>Dizer não a uma demanda extra</li></ul></div>',
      },
      {
        type: 'picker',
        question: 'Qual dessas áreas você mais deixa de lado no seu autocuidado?',
        audioQ: 'Qual dessas áreas você mais deixa de lado no seu autocuidado?',
        pills: [
          { emoji: '😴', label: 'Sono e descanso' },
          { emoji: '🍎', label: 'Alimentação e hidratação' },
          { emoji: '🤸', label: 'Movimento e corpo' },
          { emoji: '👥', label: 'Conexão social' },
          { emoji: '💆', label: 'Saúde emocional' },
        ],
        pickInstruction:
          'O cuidador deixa de lado: "{choice}". Dê uma orientação prática e acolhedora para essa área, sem cobrança.',
        onPick: (p, _idx, label) => {
          p.responses.push({ type: 'selfcare_gap', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Fale sobre limites saudáveis: limite não é abandono. Proponha exercício de autocompaixão — como o cuidador trataria um amigo na mesma situação. Feche a Jornada 5 com reflexão sobre um pequeno gesto de cuidado possível hoje.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 6', style: 'primary', action: () => startJourney(6) },
          { icon: '📊', label: 'Ver meu mapa', style: 'secondary', action: () => showScreen('mapScreen') },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    6: [
      {
        type: 'ai',
        instruction:
          'Jornada 6 — Estratégias de Manejo. Estabeleça: todo comportamento é comunicação. A criança não está sendo difícil, está tendo dificuldade. Liste o que crises podem comunicar.',
      },
      {
        type: 'picker',
        question: 'Qual situação mais desafia você no dia a dia?',
        audioQ: 'Qual situação mais desafia você no dia a dia?',
        pills: [
          { emoji: '🌪️', label: 'Crises e desregulação' },
          { emoji: '🔄', label: 'Resistência à rotina' },
          { emoji: '💬', label: 'Comunicação difícil' },
          { emoji: '👥', label: 'Situações sociais' },
        ],
        pickInstruction:
          'O maior desafio diário é: "{choice}". Ofereça estratégias práticas específicas para essa situação (durante e depois de crises, rotina, comunicação ou social). Use info-cards com listas curtas.',
        onPick: (p, _idx, label) => {
          p.responses.push({ type: 'daily_challenge', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Feche a Jornada 6: estratégias funcionam melhor com compreensão, não controle. Celebre a conclusão.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 7', style: 'primary', action: () => startJourney(7) },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    7: [
      {
        type: 'ai',
        instruction:
          'Jornada 7 — Rede de Apoio. Cuidar é trabalho coletivo. Valide a solidão que muitos cuidadores sentem. Liste tipos de apoio possíveis (família, outros pais, profissionais, grupos).',
      },
      {
        type: 'picker',
        question: 'Como você descreveria sua rede de apoio atual?',
        audioQ: 'Como você descreveria sua rede de apoio atual?',
        pills: [
          { emoji: '🟢', label: 'Tenho bom suporte' },
          { emoji: '🟡', label: 'É limitada mas existe' },
          { emoji: '🔴', label: 'Me sinto muito sozinho(a)' },
          { emoji: '🤷', label: 'Não sei ao certo' },
        ],
        pickInstruction:
          'Sobre rede de apoio: "{choice}". Responda com empatia. Se sente solidão, acolha sem minimizar. Dê dicas práticas de como pedir ajuda de forma específica.',
        onPick: (p, _idx, label) => {
          p.supportNetwork = label
          p.responses.push({ type: 'support_network', value: label })
        },
      },
      {
        type: 'ai',
        instruction: 'Feche a Jornada 7 reforçando que pedir ajuda é coragem. Mencione plantão psicológico se necessário.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 8', style: 'primary', action: () => startJourney(8) },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    8: [
      {
        type: 'ai',
        instruction:
          'Jornada 8 — Direitos. Informação é cuidado. Apresente Lei Berenice Piana (12.764/2012) e direitos essenciais: inclusão escolar, SUS, BPC, passe livre. Use info-card. Mencione direitos do cuidador no trabalho.',
      },
      {
        type: 'ai',
        instruction:
          'Fale sobre inclusão escolar na prática: PEI, pedidos por escrito, Conselho Tutelar se necessário. Feche a Jornada 8: não precisa saber tudo, precisa saber onde buscar ajuda.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 9', style: 'primary', action: () => startJourney(9) },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    9: [
      {
        type: 'ai',
        instruction:
          'Jornada 9 — Momentos de Crise. Acolha imediatamente. Peça para respirar. Tudo que sente é válido. Inclua exercício de respiração 4-4-6 em bloco reflection.',
        extras:
          '<div class="reflection"><div class="r-title">🌬️ Respiração agora</div><div class="r-q">Inspire 4 · Segure 4 · Solte 6. Repita 3 vezes.</div></div>',
      },
      {
        type: 'picker',
        question: 'Neste momento, como você está se sentindo?',
        audioQ: 'Neste momento, como você está se sentindo?',
        pills: [
          { emoji: '🌪️', label: 'Em colapso, não consigo parar' },
          { emoji: '😰', label: 'Muito ansioso e assustado' },
          { emoji: '😶', label: 'Desligado, no automático' },
          { emoji: '😤', label: 'Cheio de raiva e frustração' },
        ],
        pickInstruction:
          'Em crise, o cuidador sente: "{choice}". Acolha com urgência e calma. Valide. Priorize segurança dele(a) e da criança.',
        onPick: (p, _idx, label) => {
          p.stressLevel = 9
          p.responses.push({ type: 'crisis_state', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Ofereça técnicas de regulação rápida: grounding 5-4-3-2-1 e água gelada no rosto. Depois da crise: acolhimento, não cobrança. Não é hora de avaliar erros.',
        extras:
          '<div class="info-card"><div class="ic-title">⚡ Grounding 5-4-3-2-1</div><ul><li>5 coisas que vê</li><li>4 que toca</li><li>3 sons</li><li>2 cheiros</li><li>1 sabor</li></ul></div>',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '💜', label: 'Falar com psicólogo AGORA', sub: 'Plantão 24h', style: 'accent', action: () => openPsych() },
          { icon: '🌱', label: 'Jornada 5 — Cuidar de Si', style: 'primary', action: () => startJourney(5) },
          { icon: '📊', label: 'Ver meu mapa', style: 'secondary', action: () => showScreen('mapScreen') },
        ],
      },
    ],

    10: [
      {
        type: 'ai',
        instruction:
          'Jornada 10 — Como o Cérebro Aprende. Explique neuroplasticidade de forma acessível: cérebro aprende a vida toda. O que potencializa: vínculo, emoções positivas, repetição, ambiente seguro, sono.',
      },
      {
        type: 'ai',
        instruction:
          'Fale que pequenos avanços contam. Celebre progressos invisíveis. Liste o que NÃO acelera desenvolvimento (pressão, comparação, medo). Feche a Jornada 10.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 11', style: 'primary', action: () => startJourney(11) },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    11: [
      {
        type: 'ai',
        instruction:
          'Jornada 11 — Potencialidades e Futuro. Olhar para a criança além do diagnóstico. Liste potencialidades comuns no TEA (memória, detalhes, honestidade, interesses intensos).',
      },
      {
        type: 'ai',
        instruction:
          'Fale de esperança realista para o futuro: vidas plenas com suporte, ritmo próprio. O filho não precisa ser curado, precisa ser visto e amado. Feche a Jornada 11.',
      },
      {
        type: 'ctas',
        buildCtas: () => [
          { icon: '▶️', label: 'Continuar — Jornada 12', style: 'primary', action: () => startJourney(12) },
          { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
        ],
      },
    ],

    12: [
      {
        type: 'ai',
        instruction:
          'Jornada 12 — Escola, Sociedade e Inclusão. Fale sobre exclusão que cuidadores enfrentam. Inclusão verdadeira é pertencimento, não tolerância.',
      },
      {
        type: 'picker',
        question: 'Onde você encontra mais dificuldades relacionadas à inclusão?',
        audioQ: 'Onde você encontra mais dificuldades relacionadas à inclusão?',
        pills: [
          { emoji: '🏫', label: 'Na escola da criança' },
          { emoji: '👨‍👩‍👧‍👦', label: 'Na família e relações próximas' },
          { emoji: '🌍', label: 'Na sociedade em geral' },
          { emoji: '💼', label: 'No trabalho (minha própria inclusão)' },
        ],
        pickInstruction:
          'Maior dificuldade de inclusão: "{choice}". Dê orientações práticas em dois blocos: validação da dor + estratégias concretas para esse contexto (escola, família, sociedade ou trabalho).',
        onPick: (p, _idx, label) => {
          p.responses.push({ type: 'inclusion_challenge', value: label })
        },
      },
      {
        type: 'ai',
        instruction:
          'Parabenize por concluir TODAS as 12 jornadas! É conquista real. Reforce: não está sozinho(a), cuidar de si é cuidar da criança, a plataforma existe para ele(a). Tom celebratório e acolhedor.',
        extras:
          '<div class="info-card"><div class="ic-title">🌸 Lembre sempre</div><ul><li>Você não está sozinho(a)</li><li>Cuidar de si é cuidar da criança</li><li>Esta plataforma existe para você</li></ul></div>',
      },
      {
        type: 'ctas',
        buildCtas: () => {
          setProgress(100)
          return [
            { icon: '📊', label: 'Ver meu mapa completo', style: 'primary', action: () => showScreen('mapScreen') },
            { icon: '🔄', label: 'Revisitar jornadas', style: 'secondary', action: () => showScreen('journeyScreen') },
            { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => openPsych() },
          ]
        },
      },
    ],
  }
}
