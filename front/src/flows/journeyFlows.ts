// @ts-nocheck
import type { ChatApi } from '../types/chat';
import { JOURNEYS } from '../data/journeys';

export function createJourneyRunner(api: ChatApi) {
  const profile = api.getProfile();

  const MOOD = {
    'No limite':  {text:'Quando você está no limite, seu corpo e sua mente estão pedindo pausa, não cobrança.\n\nAqui, o cuidado começa com você. Vamos respirar juntos. 💙',audio:'Quando você está no limite, seu corpo e sua mente estão pedindo pausa. Aqui, o cuidado começa com você.',stress:8,sc:2,j:9},
    'Cansado(a)': {text:'O cansaço é um sinal de amor prolongado sem descanso suficiente.\n\nVocê não está fraco(a) — está sobrecarregado(a). Aqui, isso tem espaço. 🌿',audio:'O cansaço é um sinal de amor prolongado sem descanso suficiente. Você não está fraco, está sobrecarregado.',stress:6,sc:3,j:5},
    'Confuso(a)': {text:'A confusão é comum quando a informação é demais e o apoio é de menos.\n\nVamos organizar tudo em passos simples, sem pressa. 📚',audio:'A confusão é comum quando a informação é demais e o apoio é de menos. Vamos organizar tudo em passos simples.',stress:5,sc:4,j:2},
    'Estou bem':  {text:'Que bom! 🙂 Mesmo nos dias bons, o cuidado preventivo fortalece você para os dias difíceis.\n\nVamos explorar juntos?',audio:'Que bom! Mesmo nos dias bons, o cuidado preventivo fortalece você para os dias difíceis.',stress:2,sc:7,j:2},
    'Não sei dizer':{text:'Às vezes é difícil nomear o que sentimos. Isso também é um sinal importante.\n\nVamos começar com uma checagem para entender melhor o seu momento. 💭',audio:'Às vezes é difícil nomear o que sentimos. Isso também é um sinal importante. Vamos começar com uma checagem para entender melhor seu momento.',stress:4,sc:4,j:4},
  } as const;

  function startIntroFlow() {
  api.setProgress(5);
  api.showTyping(()=>{
    api.addAiMsg('Olá! Que coisa boa contar com a sua presença aqui! 💜\n\nSe você está aqui, é porque uma parte sua também pediu atenção. Este espaço foi criado para você.','Olá! Que coisa boa contar com a sua presença aqui! Se você está aqui, é porque uma parte sua também pediu atenção. Este espaço foi criado para você.');
  },1200);
  setTimeout(()=>api.showTyping(()=>{
    api.addPicker('Como você está se sentindo <strong>hoje</strong>?','Como você está se sentindo hoje?',
      [{emoji:'😔',label:'No limite'},{emoji:'🫥',label:'Cansado(a)'},{emoji:'🤔',label:'Confuso(a)'},{emoji:'🙂',label:'Estou bem'},{emoji:'❓',label:'Não sei dizer'}],
      handleMoodPick);
  },1800),3000);
}

  function handleMoodPick(idx, label) {
  const key = Object.keys(MOOD).find(k => label.includes(k)) || 'Não sei dizer';
  const r = MOOD[key];
  profile.emotionToday = key; profile.stressLevel = r.stress; profile.selfcareLevel = r.sc;
  profile.responses.push({type:'mood',value:key}); api.updateMap(); api.setProgress(15);
  api.showTyping(()=>{
    api.addAiMsg(r.text, r.audio);
    setTimeout(()=>api.showTyping(()=>api.suggestBlock(JOURNEYS.find(j=>j.n===r.j)||JOURNEYS[0]),1600),800);
  });
}

  function sendMessage(text: string) {
    if (!text.trim()) return;
    api.addUserMsg(text);
    profile.responses.push({ type: 'text', text, time: Date.now() });
    api.updateMap();
    api.showTyping(() => {
      const l = text.toLowerCase();
      if (l.includes('crise') || l.includes('limite') || l.includes('desespero')) {
        api.addAiMsg(
          'Ouço você. Esse momento pede cuidado imediato. 💙\nVocê não está sozinho(a).',
          'Ouço você. Esse momento pede cuidado imediato. Você não está sozinho.',
        );
        profile.stressLevel = Math.min(10, profile.stressLevel + 3);
        setTimeout(
          () =>
            api.addCtas([
              { icon: '🌊', label: 'Jornada 9 — Momentos de Crise', style: 'primary', action: () => startJourney(9) },
              { icon: '💜', label: 'Falar com psicólogo agora', sub: 'Plantão 24h', style: 'accent', action: () => api.openPsych() },
            ]),
          700,
        );
      } else if (l.includes('cansad') || l.includes('exaust') || l.includes('esgot')) {
        api.addAiMsg(
          'O cansaço que você sente é real e válido. 🌱\nCuidadores não adoecem por serem fracos — adoecem por ficarem fortes por tempo demais.',
          'O cansaço que você sente é real e válido. Cuidadores não adoecem por serem fracos. Adoecem por ficarem fortes por tempo demais.',
        );
        profile.stressLevel = Math.min(10, profile.stressLevel + 2);
        setTimeout(
          () =>
            api.addCtas([
              { icon: '🌱', label: 'Jornada 5 — Cuidar de Si', style: 'primary', action: () => startJourney(5) },
              { icon: '💜', label: 'Falar com psicólogo', style: 'accent', action: () => api.openPsych() },
            ]),
          700,
        );
      } else if (l.includes('diagnósti') || l.includes('tea') || l.includes('autis')) {
        api.addAiMsg(
          'O diagnóstico traz muitas emoções ao mesmo tempo. É completamente normal. 🧩',
          'O diagnóstico traz muitas emoções ao mesmo tempo. É completamente normal.',
        );
        setTimeout(
          () =>
            api.addCtas([
              { icon: '🧩', label: 'Jornada 2 — Compreendendo o TEA', style: 'primary', action: () => startJourney(2) },
            ]),
          700,
        );
      } else {
        api.addAiMsg(
          'Obrigada por compartilhar isso comigo. Estou aqui, escutando. 💙\nComo posso te ajudar?',
          'Obrigada por compartilhar isso comigo. Estou aqui, escutando. Como posso te ajudar?',
        );
      }
      api.updateMap();
    });
  }

// ═══════════════════════ START JOURNEY ═══════════════════════
  function startJourney(n: number) {
  api.showScreen('chatScreen');
  if (!profile.journeysCompleted.includes(n)) profile.journeysCompleted.push(n);
  api.setProgress(Math.min(100, profile.journeysCompleted.length * 8 + 10));
  api.updateMap();
  const flows = {1:j1,2:j2,3:j3,4:j4,5:j5,6:j6,7:j7,8:j8,9:j9,10:j10,11:j11,12:j12};
  (flows[n] || j1)();
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 1 — ACOLHIMENTO E CHEGADA                      ║
// ╚══════════════════════════════════════════════════════════╝
  function j1() {
  api.addUserMsg('Jornada 1 — Acolhimento e Chegada 🤗');
  api.showTyping(()=>{
    api.addAiMsg('Olá! Que coisa boa contar com a tua presença aqui!\n\nAntes de qualquer explicação, eu quero falar sobre <strong>estar aqui</strong>.\n\nEstar aqui não é um acaso. É um gesto silencioso de quem percebeu que seguir sozinho estava pesado demais.','Olá! Que coisa boa contar com a tua presença aqui! Antes de qualquer explicação, eu quero falar sobre estar aqui. Estar aqui não é um acaso. É um gesto silencioso de quem percebeu que seguir sozinho estava pesado demais.');
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Muitas pessoas chegam até aqui depois de tentarem ser fortes por muito tempo.\n\nTentaram entender tudo sozinhas.\nTentaram dar conta de tudo.\nTentaram não incomodar.\n\nE, em algum momento, algo interno disse:\n<em>"Eu preciso de um lugar onde eu possa respirar."</em>','Muitas pessoas chegam até aqui depois de tentarem ser fortes por muito tempo. E em algum momento, algo interno disse: eu preciso de um lugar onde eu possa respirar.');
      setTimeout(()=>api.showTyping(()=>j1_modoCuidado(),2400),800);
    },2200),1000);
  });
}

  function j1_modoCuidado() {
  api.addAiMsg('Quando vivemos por muito tempo sob pressão, o cérebro entra no <strong>modo sobrevivência</strong>.\n\nNesse estado, ele está o tempo todo tentando proteger você de ameaças — mesmo que elas não sejam físicas.','Quando vivemos por muito tempo sob pressão, o cérebro entra no modo sobrevivência. Esse estado está tentando proteger você de ameaças, mesmo que elas não sejam físicas.',
  `<div class="info-card"><div class="ic-title">⚡ Modo sobrevivência</div><ul><li>Pensamento acelerado ou confuso</li><li>Emoções intensas ou "anestesiadas"</li><li>Corpo tenso, cansado, exausto</li><li>Tudo parece urgente e pesado demais</li></ul></div>`);
  setTimeout(()=>api.showTyping(()=>{
    api.addAiMsg('Quando você busca acolhimento, algo importante acontece:\n\nSeu cérebro começa, lentamente, a sair do modo sobrevivência e a se aproximar do <strong>modo cuidado</strong>.','Quando você busca acolhimento, seu cérebro começa lentamente a sair do modo sobrevivência e se aproximar do modo cuidado.',
    `<div class="info-card"><div class="ic-title">🌱 Modo cuidado</div><ul><li>O corpo começa a relaxar um pouco</li><li>A respiração fica mais profunda</li><li>Os pensamentos desaceleram</li><li>Surge espaço para sentir e refletir</li></ul></div><div class="hquote">Ninguém entra no modo cuidado de uma vez. É um processo gradual, feito de pequenas pausas. Estar aqui já é uma dessas pausas.</div>`);
    setTimeout(()=>api.showTyping(()=>j1_percepcao(),2200),800);
  },2400),800);
}

  function j1_percepcao() {
  api.addPicker('Perceba agora, sem se julgar:\n\n👉 Nos últimos dias, você tem se sentido mais:','Perceba agora, sem se julgar. Nos últimos dias, você tem se sentido mais:',
    [{emoji:'🔥',label:'Sempre em alerta'},{emoji:'🪫',label:'Exausto mesmo descansando'},{emoji:'🌫️',label:'Confuso e sobrecarregado'},{emoji:'🌱',label:'Algo começou a aliviar'}],
    (idx,label)=>{
      profile.stressLevel = [8,7,6,3][idx]||5; profile.responses.push({type:'j1_state',value:label}); api.updateMap();
      api.showTyping(()=>{
        api.addAiMsg('Essa percepção já é um passo fora do modo sobrevivência. 💙\n\nAqui, você não precisa provar nada. Não precisa ser forte o tempo todo. Não precisa saber o que fazer agora.\n\nVamos começar cuidando de você — no seu tempo, do seu jeito.','Essa percepção já é um passo fora do modo sobrevivência. Aqui, você não precisa provar nada. Vamos começar cuidando de você, no seu tempo, do seu jeito.');
        setTimeout(()=>api.showTyping(()=>j1_cuidador(),2200),800);
      });
    });
}

  function j1_cuidador() {
  api.addAiMsg('Agora quero te convidar a olhar para algo que quase sempre fica em segundo plano.\n\n👉 <strong>Você.</strong>\n\nCuidar de alguém exige presença, atenção, entrega. E, com o tempo, é comum que o papel de cuidador vá ocupando todos os espaços — até que a pessoa por trás do cuidado fique invisível.','Agora quero te convidar a olhar para algo que quase sempre fica em segundo plano. Você. Cuidar de alguém exige presença, atenção, entrega.',
  `<div class="hquote">Cuidadores não adoecem porque são fracos. Eles adoecem porque permanecem fortes por tempo demais.</div>`);
  setTimeout(()=>api.showTyping(()=>{
    api.addPicker('👉 Nos últimos tempos, como você tem se colocado na própria vida?','Nos últimos tempos, como você tem se colocado na própria vida?',
      [{emoji:'🫥',label:'Tenho me sentido invisível'},{emoji:'⚖️',label:'Tento equilibrar'},{emoji:'😔',label:'Sinto culpa quando penso em mim'},{emoji:'🌱',label:'Preciso cuidar mais de mim'},{emoji:'🤍',label:'Consigo às vezes'}],
      (idx,label)=>{
        const keys = ['Tenho me sentido invisível','Tento equilibrar','Sinto culpa quando penso em mim','Preciso cuidar mais de mim','Consigo às vezes'];
        const key = keys[idx];
        profile.caregiverRole = key; profile.responses.push({type:'caregiver_role',value:key}); api.updateMap();
        profile.selfcareLevel = [2,4,3,5,6][idx]||3;
        const resps = {
          'Tenho me sentido invisível':'Sentir-se invisível dói mais do que parece. Geralmente isso acontece quando você esteve disponível para todos por tanto tempo, que esqueceu de reservar espaço para si.\n\n<strong>Nada em você desapareceu — apenas ficou sem lugar.</strong>\n\nAqui, sua presença é vista.',
          'Tento equilibrar':'Tentar equilibrar já mostra consciência e esforço. Mas quando você fica sempre por último, o cansaço se acumula em silêncio.\n\nNão é falta de organização — é excesso de responsabilidade.',
          'Sinto culpa quando penso em mim':'A culpa costuma aparecer quando você aprendeu que cuidar de si significa abandonar alguém.\n\n<strong>Mas isso não é verdade.</strong>\n\nCuidar de você não diminui o cuidado com o outro — sustenta.',
          'Preciso cuidar mais de mim':'Reconhecer essa necessidade já é o começo. Muitas vezes, o "não saber por onde" vem do cansaço — não da falta de vontade.\n\nAqui, você não precisa ter um plano.',
          'Consigo às vezes':'Isso mostra que você já experimentou o autocuidado — e sabe o quanto ele é necessário.\n\nA dificuldade em manter não é falha; é falta de sustentação externa.'
        };
        const audios = {
          'Tenho me sentido invisível':'Sentir-se invisível dói mais do que parece. Nada em você desapareceu, apenas ficou sem lugar. Aqui, sua presença é vista.',
          'Tento equilibrar':'Tentar equilibrar já mostra consciência. Não é falta de organização, é excesso de responsabilidade.',
          'Sinto culpa quando penso em mim':'A culpa costuma aparecer quando você aprendeu que cuidar de si significa abandonar alguém. Mas isso não é verdade.',
          'Preciso cuidar mais de mim':'Reconhecer essa necessidade já é o começo.',
          'Consigo às vezes':'Isso mostra que você já experimentou o autocuidado e sabe o quanto ele é necessário.'
        };
        api.showTyping(()=>{
          api.addAiMsg(resps[key], audios[key]);
          setTimeout(()=>api.showTyping(()=>j1_fechamento(),2200),800);
        });
      });
  },2400),800);
}

  function j1_fechamento() {
  api.addAiMsg('Essa jornada não é sobre mudar tudo agora.\n\nÉ sobre reconhecer que <strong>você importa nesse processo</strong>.\n\n👉 Seu lugar como cuidador não deve anular seu lugar como pessoa.\n\nAqui, a gente constrói caminhos onde o cuidado <strong>inclui você</strong>.','Essa jornada não é sobre mudar tudo agora. É sobre reconhecer que você importa nesse processo.',
  `<div class="reflection"><div class="r-title">💭 Para reflexão</div><div class="r-q">• O que você costuma abrir mão quando precisa dar conta de tudo?<br>• O que em você está pedindo atenção há mais tempo?<br>• Como seu corpo tem sinalizado cansaço?</div></div>`);
  setTimeout(()=>api.showTyping(()=>{
    api.addAiMsg('Quando estiver pronto(a), podemos seguir para a <strong>Microjornada 1.3 — Normalizando sentimentos difíceis</strong>.\n\nVocê não precisa chegar pronto. Você só precisa chegar como está. 🌸','Quando estiver pronto, podemos seguir para a próxima etapa. Você não precisa chegar pronto. Você só precisa chegar como está.');
    setTimeout(()=>api.addCtas([
      {icon:'▶️',label:'Continuar — Microjornada 1.3',style:'primary',action: () => j1_sentimentos()},
      {icon:'🗺️',label:'Ver outras jornadas',style:'secondary',action: () => api.showScreen('journeyScreen')},
      {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
    ]),400);
  },2000),1000);
}

  function j1_sentimentos() {
  api.showTyping(()=>{
    api.addAiMsg('Se você chegou até aqui, provavelmente já percebeu que cuidar não é feito só de amor.\n\nÉ feito também de sentimentos que quase nunca ganham espaço para existir.\n\nAqui, a gente vai falar sobre eles — não para consertar, não para julgar, mas para <strong>normalizar</strong>.','Cuidar não é feito só de amor. É feito também de sentimentos que quase nunca ganham espaço. Aqui, a gente vai falar sobre eles para normalizar.',
    `<div class="hquote">Sentir não te torna fraco. Te torna humano.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Muitos cuidadores tentam empurrar esses sentimentos para longe:\n\n<em>"Não posso sentir isso."</em>\n<em>"Tem gente em situação pior."</em>\n<em>"Eu deveria ser mais forte."</em>\n\nMas sentimentos ignorados não desaparecem. Eles se acumulam — e voltam como cansaço extremo, irritação ou sensação de vazio.','Muitos cuidadores tentam empurrar esses sentimentos para longe. Mas sentimentos ignorados não desaparecem. Eles se acumulam e voltam em forma de cansaço extremo ou irritação.');
      setTimeout(()=>api.showTyping(()=>{
        api.addPicker('👉 Nos últimos tempos, quais sentimentos têm aparecido com mais frequência?','Nos últimos tempos, quais sentimentos têm aparecido com mais frequência?',
          [{emoji:'😔',label:'Tristeza ou desânimo'},{emoji:'😤',label:'Irritação ou raiva'},{emoji:'😟',label:'Medo de errar'},{emoji:'😶',label:'Sensação de vazio'},{emoji:'🤍',label:'Amor com muito cansaço'},{emoji:'❓',label:'Não sei identificar'}],
          (idx,label)=>{
            profile.emotionsFound.push(label); profile.responses.push({type:'emotions',value:label}); api.updateMap();
            api.showTyping(()=>{
              api.addAiMsg('Seja qual for a sua resposta, ela faz sentido dentro da história que você está vivendo.\n\n<strong>Nenhum desses sentimentos invalida o amor, o cuidado ou a dedicação que existem em você.</strong>\n\nEles apenas mostram que algo aí dentro também precisa ser cuidado. 💙','Seja qual for a sua resposta, ela faz sentido dentro da história que você está vivendo. Nenhum desses sentimentos invalida o amor que existe em você.',
              `<div class="reflection"><div class="r-title">💭 Um exercício simples</div><div class="r-q">Se esse sentimento pudesse falar, o que ele estaria tentando te dizer?<br><br>"Eu preciso de descanso."<br>"Eu estou sozinho(a)."<br>"Estou com medo."<br><br>Apenas escute. Escutar já é cuidado.</div></div>`);
              setTimeout(()=>api.showTyping(()=>{
                api.addAiMsg('Você não está errado(a) por sentir o que sente.\n\nVocê está humano(a) em um contexto exigente. 🌸\n\n<strong>Jornada 1 concluída!</strong> Seu mapa foi atualizado.','Você não está errado por sentir o que sente. Você está humano em um contexto exigente. Jornada 1 concluída!');
                setTimeout(()=>api.addCtas([
                  {icon:'▶️',label:'Continuar — Jornada 2',style:'primary',action: () => j2()},
                  {icon:'📊',label:'Ver meu mapa emocional',style:'secondary',action: () => api.showScreen('mapScreen')},
                  {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
                ]),400);
              },2400),800);
            });
          });
      },2200),800);
    },2200),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 2 — COMPREENDENDO O TEA                        ║
// ╚══════════════════════════════════════════════════════════╝
  function j2() { api.addUserMsg('Jornada 2 — Compreendendo o TEA 🧩'); flowJ2(); }
  function flowJ2() {
  api.showTyping(()=>{
    api.addAiMsg('Nesta jornada, vamos ajustar a forma como olhamos para o TEA. 🧩\n\nAntes de qualquer coisa:','Nesta jornada, vamos ajustar a forma como olhamos para o TEA.',
    `<div class="hquote">Conhecimento não tira a sensibilidade — ele fortalece.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('O <strong>Transtorno do Espectro Autista</strong> não é uma doença. É uma condição do neurodesenvolvimento.\n\nIsso significa que o cérebro funciona de um jeito diferente — com suas próprias formas de perceber, sentir e interagir com o mundo.','O Transtorno do Espectro Autista não é uma doença. É uma condição do neurodesenvolvimento. O cérebro funciona de um jeito diferente.',
      `<div class="info-card"><div class="ic-title">✅ Pontos essenciais</div><ul><li>O autismo não é causado por falta de afeto ou educação</li><li>Não é algo que você causou</li><li>É uma forma de diversidade neurológica</li><li>Não existe "cura" — existe suporte e desenvolvimento</li></ul></div>`);
      setTimeout(()=>api.showTyping(()=>j2_espectro(),2200),800);
    },2400),800);
  });
}

  function j2_espectro() {
  api.addAiMsg('A palavra <strong>espectro</strong> indica diversidade. Não existe um único tipo de autismo — cada pessoa tem características únicas.','A palavra espectro indica diversidade. Não existe um único tipo de autismo.',
  `<div class="info-card"><div class="ic-title">1️⃣ Comunicação e interação social</div><ul><li>Dificuldade no "vai e vem" da conversa</li><li>Desafios com expressões faciais, gestos e ironia</li></ul></div>
  <div class="info-card" style="margin-top:8px"><div class="ic-title">2️⃣ Comportamentos e rotinas</div><ul><li>Preferência por rotinas previsíveis e seguras</li><li>Interesses intensos e específicos</li><li>Movimentos repetitivos (regulação emocional)</li></ul></div>
  <div class="info-card" style="margin-top:8px"><div class="ic-title">3️⃣ Processamento sensorial</div><ul><li>Sensibilidade a sons, luzes, cheiros, toques</li><li>Ou busca por estímulos mais intensos</li></ul></div>
  <div class="hquote" style="margin-top:8px">"Se você conhece uma pessoa autista, você conhece uma pessoa autista." — Cada criança é única no espectro.</div>`);
  setTimeout(()=>api.showTyping(()=>{
    api.addPicker('Ao pensar na criança com TEA, em qual área você percebe <strong>mais desafios</strong> no dia a dia?','Em qual área você percebe mais desafios no dia a dia?',
      [{emoji:'💬',label:'Comunicação e interação'},{emoji:'🔄',label:'Rotinas e comportamentos'},{emoji:'👂',label:'Sensibilidade sensorial'}],
      (idx,label)=>{
        profile.challengeArea = label; profile.responses.push({type:'challenge_area',value:label}); api.updateMap();
        api.showTyping(()=>{
          api.addAiMsg('Essas áreas podem trazer desafios muito reais para o cuidador. 💙\n\nAo longo das próximas jornadas, vamos explorar estratégias práticas para cada uma delas.\n\n<strong>Você está dando um passo essencial ao buscar entender.</strong>','Essas áreas podem trazer desafios muito reais. Ao longo das próximas jornadas, vamos explorar estratégias práticas para cada uma delas.');
          setTimeout(()=>api.showTyping(()=>j2_neurodiversidade(),2200),800);
        });
      });
  },2400),800);
}

  function j2_neurodiversidade() {
  api.addAiMsg('Agora quero te apresentar um conceito que <strong>muda tudo</strong>:\n\n🌈 <strong>Neurodiversidade</strong>\n\nÉ a ideia de que existem muitos jeitos legítimos de funcionar cognitivamente. O cérebro autista não é inferior — é diferente.','Agora quero te apresentar um conceito que muda tudo. Neurodiversidade. É a ideia de que existem muitos jeitos legítimos de funcionar cognitivamente.',
  `<div class="hquote">Diferença não é déficit. É uma forma diferente de estar no mundo.</div>`);
  setTimeout(()=>api.showTyping(()=>{
    api.addPicker('Como você se sentiu ao ler sobre neurodiversidade?','Como você se sentiu ao ler sobre neurodiversidade?',
      [{emoji:'💡',label:'Abriu uma nova perspectiva'},{emoji:'😌',label:'Me trouxe alívio'},{emoji:'🤔',label:'Ainda tenho dúvidas'},{emoji:'😔',label:'É difícil de aceitar ainda'}],
      (idx,label)=>{
        profile.responses.push({type:'neurodiversity_reaction',value:label}); api.updateMap();
        const resps = ['Que ótimo! Essa abertura faz toda a diferença no cuidado. 💙','Esse alívio é muito válido. Compreender liberta. 🌸','Dúvidas fazem parte do processo. Vamos construir juntos, passo a passo. 🌱','Aceitar é um processo. Não precisa acontecer de uma vez. É normal levar tempo. 💜'];
        api.showTyping(()=>{
          api.addAiMsg(resps[idx]||resps[0], resps[idx]||resps[0]);
          setTimeout(()=>api.showTyping(()=>{
            api.addAiMsg('Conhecimento é uma forma de empoderamento. Ele reduz o medo e amplia as possibilidades de cuidado. 🌱\n\n<strong>Jornada 2 concluída!</strong> Seu mapa foi atualizado.','Conhecimento é uma forma de empoderamento. Jornada 2 concluída!');
            setTimeout(()=>api.addCtas([
              {icon:'▶️',label:'Continuar — Jornada 3',style:'primary',action: () => j3()},
              {icon:'📊',label:'Ver meu mapa',style:'secondary',action: () => api.showScreen('mapScreen')},
              {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
            ]),400);
          },2000),800);
        });
      });
  },2200),800);
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 3 — SENTIMENTOS DIANTE DO DIAGNÓSTICO          ║
// ╚══════════════════════════════════════════════════════════╝
  function j3() { api.addUserMsg('Jornada 3 — Sentimentos diante do diagnóstico 💭');
  api.showTyping(()=>{
    api.addAiMsg('Receber — ou conviver — com um diagnóstico não impacta apenas a criança. Ele atravessa quem cuida.\n\nMuitos cuidadores relatam um misto de emoções: amor, medo, luto, esperança, exaustão. Nenhuma delas é errada.','Receber ou conviver com um diagnóstico não impacta apenas a criança. Ele atravessa quem cuida. Muitos cuidadores relatam um misto de emoções. Nenhuma delas é errada.',
    `<div class="hquote">Tudo o que você sente merece espaço.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('O diagnóstico pode ativar um processo semelhante ao <strong>luto simbólico</strong>: não pelo filho real, mas pelas expectativas que foram criadas.\n\nReconhecer isso ajuda a reduzir culpa e isolamento.','O diagnóstico pode ativar um processo semelhante ao luto simbólico. Não pelo filho real, mas pelas expectativas que foram criadas. Reconhecer isso ajuda a reduzir culpa e isolamento.',
      `<div class="info-card"><div class="ic-title">🌊 Fases comuns do luto simbólico</div><ul><li>Negação: "Talvez seja engano..."</li><li>Raiva: "Por que comigo? Por que ele?"</li><li>Negociação: "E se eu fizer mais...?"</li><li>Tristeza: O peso da realidade</li><li>Aceitação: Ressignificação e nova perspectiva</li></ul></div>
      <div class="hquote" style="margin-top:8px">Essas fases não são lineares. Você pode sentir várias ao mesmo tempo.</div>`);
      setTimeout(()=>api.showTyping(()=>{
        api.addPicker('Marque o que você já sentiu desde o diagnóstico:','Marque o que você já sentiu desde o diagnóstico:',
          [{emoji:'😨',label:'Medo do futuro'},{emoji:'😔',label:'Culpa'},{emoji:'😢',label:'Tristeza'},{emoji:'😮‍💨',label:'Alívio por ter respostas'},{emoji:'🥱',label:'Cansaço profundo'}],
          (idx,label)=>{
            profile.emotionsFound.push(label); profile.responses.push({type:'diagnosis_emotion',value:label}); api.updateMap();
            api.showTyping(()=>{
              api.addAiMsg('Seja qual for o que você marcou, isso faz parte da sua história. E essa história merece ser acolhida.\n\nVamos fazer um pequeno exercício:','Seja qual for o que você marcou, isso faz parte da sua história e merece ser acolhida.',
              `<div class="reflection"><div class="r-title">✍️ Exercício reflexivo</div><div class="r-q">Complete mentalmente a frase:<br><br>"Eu me permito sentir _______ porque estou vivendo algo desafiador."<br><br>Não precisa responder em voz alta. Apenas perceber já é um gesto de cuidado.</div></div>`);
              setTimeout(()=>api.showTyping(()=>{
                api.addAiMsg('A <strong>culpa</strong> é um dos sentimentos mais comuns entre cuidadores. E um dos mais pesados.\n\nMuitos se perguntam: "Fiz algo errado?" "Poderia ter prevenido?"\n\nA resposta é não. O autismo não é causado por ações dos pais.','A culpa é um dos sentimentos mais comuns entre cuidadores. Muitos se perguntam se fizeram algo errado. A resposta é não. O autismo não é causado por ações dos pais.');
                setTimeout(()=>api.showTyping(()=>{
                  api.addAiMsg('<strong>Jornada 3 concluída!</strong> Você deu um passo corajoso ao explorar esses sentimentos. 💜\n\nSe este conteúdo despertou emoções difíceis, você pode seguir para a Jornada 5 — Cuidar de Si, ou acionar o plantão psicológico.','Jornada 3 concluída! Você deu um passo corajoso ao explorar esses sentimentos.');
                  setTimeout(()=>api.addCtas([
                    {icon:'▶️',label:'Continuar — Jornada 4',style:'primary',action: () => j4()},
                    {icon:'🌱',label:'Jornada 5 — Cuidar de Si',style:'secondary',action: () => j5()},
                    {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
                  ]),400);
                },2200),800);
              },2200),800);
            });
          });
      },2200),800);
    },2400),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 4 — AUTOAVALIAÇÃO E AUTOPERCEPÇÃO              ║
// ╚══════════════════════════════════════════════════════════╝
  function j4() { api.addUserMsg('Jornada 4 — Autoavaliação e Autopercepção 🔍');
  api.showTyping(()=>{
    api.addAiMsg('Esta jornada é sobre você se ver com mais clareza.\n\nNão para se julgar — mas para entender onde está e o que precisa.\n\n🌿 Vamos fazer uma checagem emocional gentil.','Esta jornada é sobre você se ver com mais clareza. Não para se julgar, mas para entender onde está e o que precisa.');
    setTimeout(()=>api.showTyping(()=>{
      api.addPicker('Quando você pensa na sua vida hoje, você sente que:','Quando você pensa na sua vida hoje, você sente que:',
        [{emoji:'🔴',label:'Está no limite'},{emoji:'🟡',label:'Está cansado mas seguindo'},{emoji:'🟠',label:'Está confuso'},{emoji:'🟢',label:'Está emocionalmente bem'},{emoji:'⚪',label:'Não sabe dizer'}],
        (idx,label)=>{
          profile.stressLevel = [9,6,5,2,4][idx]||5; profile.responses.push({type:'check_in',value:label}); api.updateMap();
          const feedback = [
            'Estar no limite é um sinal muito importante. Prioridade agora é reduzir a sobrecarga — não resolver tudo.',
            'Cansado mas seguindo mostra resiliência real. E também pede atenção — o cansaço acumulado tem um custo.',
            'A confusão aparece quando há muita demanda e pouco tempo para organizar. Vamos dar clareza passo a passo.',
            'Que bom! Momentos de equilíbrio são valiosos. Use esse momento para preventir e fortalecer.',
            'Não saber dizer também é um dado. Às vezes o corpo sabe antes da mente.'
          ];
          api.showTyping(()=>{
            api.addAiMsg(feedback[idx]||feedback[4], feedback[idx]||feedback[4]);
            setTimeout(()=>api.showTyping(()=>j4_sinais(),2000),800);
          });
        });
    },2200),800);
  });
}

  function j4_sinais() {
  api.addPicker('Nos últimos dias, você tem notado em você:','Nos últimos dias, você tem notado em você:',
    [{emoji:'😴',label:'Dificuldade para dormir ou descansar'},{emoji:'🧠',label:'Pensamentos que não param'},{emoji:'😤',label:'Irritação fácil com pequenas coisas'},{emoji:'😶',label:'Desconexão ou vazio interior'},{emoji:'🤢',label:'Sintomas físicos: cabeça, barriga, cansaço'}],
    (idx,label)=>{
      profile.responses.push({type:'burnout_signal',value:label}); api.updateMap();
      if (idx <= 1) profile.stressLevel = Math.min(10, profile.stressLevel+1);
      api.showTyping(()=>{
        api.addAiMsg('Esses sinais são o corpo e a mente tentando te dizer que algo precisa de atenção.\n\nNão são fraqueza. São alertas importantes.','Esses sinais são o corpo e a mente tentando te dizer que algo precisa de atenção. Não são fraqueza. São alertas importantes.',
        `<div class="info-card"><div class="ic-title">⚠️ Sinais de esgotamento emocional</div><ul><li>Exaustão persistente mesmo com descanso</li><li>Perda de prazer em atividades antes satisfatórias</li><li>Irritabilidade ou choro sem motivo claro</li><li>Sensação de estar "no automático"</li><li>Dificuldade de concentração</li></ul></div>`);
        setTimeout(()=>api.showTyping(()=>j4_autocuidado(),2200),800);
      });
    });
}

  function j4_autocuidado() {
  api.addPicker('Como anda o seu autocuidado nos últimos tempos?','Como anda o seu autocuidado nos últimos tempos?',
    [{emoji:'✅',label:'Consigo me cuidar razoavelmente'},{emoji:'⚠️',label:'Me cuido pouco, mas tento'},{emoji:'❌',label:'Praticamente não me cuido'},{emoji:'🤷',label:'Nem sei mais o que seria me cuidar'}],
    (idx,label)=>{
      profile.selfcareLevel = [7,4,2,3][idx]||3; profile.responses.push({type:'selfcare_level',value:label}); api.updateMap();
      api.showTyping(()=>{
        api.addAiMsg(['Ótimo! Manter práticas de autocuidado faz uma diferença real no longo prazo.','Tentar já é muito. Vamos construir pequenos passos para tornar isso mais possível.','Quando o autocuidado zera, o desgaste se acelera. Vamos trabalhar nisso juntos, sem cobrança.','Às vezes é preciso voltar ao básico. O que você gostava de fazer antes do cuidado tomar todo o espaço?'][idx]||'', '');
        setTimeout(()=>api.showTyping(()=>{
          api.addAiMsg('<strong>Jornada 4 concluída!</strong> Você fez uma avaliação corajosa e honesta de como está. 💜\n\nIsso já é autocuidado.','Jornada 4 concluída! Você fez uma avaliação corajosa de como está. Isso já é autocuidado.');
          setTimeout(()=>api.addCtas([
            {icon:'▶️',label:'Continuar — Jornada 5',style:'primary',action: () => j5()},
            {icon:'📊',label:'Ver meu mapa',style:'secondary',action: () => api.showScreen('mapScreen')},
            {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
          ]),400);
        },2000),800);
      });
    });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 5 — CUIDAR DE SI PARA CONTINUAR                ║
// ╚══════════════════════════════════════════════════════════╝
  function j5() { api.addUserMsg('Jornada 5 — Cuidar de Si para Continuar 🌱');
  api.showTyping(()=>{
    api.addAiMsg('Autocuidado não é egoísmo. É sustentação. 🌱\n\nCuidar de você não diminui o cuidado com o outro — sustenta. Sem você bem, o cuidado se fragiliza.','Autocuidado não é egoísmo. É sustentação. Cuidar de você não diminui o cuidado com o outro, sustenta.',
    `<div class="hquote">Você não pode dar o que não tem. E não pode ajudar de dentro de um copo vazio.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Muitos cuidadores têm uma imagem de autocuidado muito idealizada:\n\n<em>"Só conta se for spa, viagem, academia..."</em>\n\nMas <strong>autocuidado real</strong> são os pequenos gestos possíveis dentro da sua rotina.','Muitos cuidadores têm uma imagem de autocuidado muito idealizada. Mas autocuidado real são os pequenos gestos possíveis dentro da sua rotina.',
      `<div class="info-card"><div class="ic-title">🌿 Autocuidado possível</div><ul><li>5 minutos de silêncio antes de começar o dia</li><li>Uma xícara de café quente sem fazer mais nada ao mesmo tempo</li><li>Sair para uma caminhada curta</li><li>Falar com um amigo sem falar de cuidado</li><li>Dormir um pouco mais quando for possível</li><li>Dizer "não" a uma demanda extra</li></ul></div>`);
      setTimeout(()=>api.showTyping(()=>{
        api.addPicker('Qual dessas áreas você mais deixa de lado no seu autocuidado?','Qual dessas áreas você mais deixa de lado no seu autocuidado?',
          [{emoji:'😴',label:'Sono e descanso'},{emoji:'🍎',label:'Alimentação e hidratação'},{emoji:'🤸',label:'Movimento e corpo'},{emoji:'👥',label:'Conexão social'},{emoji:'💆',label:'Saúde emocional'}],
          (idx,label)=>{
            profile.responses.push({type:'selfcare_gap',value:label}); api.updateMap();
            const tips = [
              'O sono é o autocuidado mais fundamental. Sem ele, tudo fica mais difícil. Pequenas melhorias no sono têm grande impacto.',
              'O corpo precisa de combustível. Comer com atenção, mesmo que seja algo simples, já faz diferença.',
              'Movimento, mesmo que leve, libera hormônios que ajudam com o estresse. Uma caminhada já conta.',
              'Isolamento piora a sobrecarga. Manter ao menos uma conexão próxima é protetor para a saúde mental.',
              'Sua saúde emocional é a base de tudo. Esta plataforma é um espaço para isso!'
            ];
            api.showTyping(()=>{
              api.addAiMsg(tips[idx]||tips[0], tips[idx]||tips[0]);
              setTimeout(()=>api.showTyping(()=>j5_limites(),2000),800);
            });
          });
      },2200),800);
    },2200),800);
  });
}

  function j5_limites() {
  api.addAiMsg('Um aspecto essencial do autocuidado que pouco se fala:\n\n<strong>Limites saudáveis.</strong>\n\nLimite não é abandono. É a definição de até onde você pode ir sem se perder.','Um aspecto essencial do autocuidado que pouco se fala: limites saudáveis. Limite não é abandono. É a definição de até onde você pode ir sem se perder.',
  `<div class="info-card"><div class="ic-title">🛡️ Limites saudáveis</div><ul><li>Dizer "não" sem culpa para demandas extras</li><li>Pedir ajuda sem se sentir fraco</li><li>Reconhecer quando precisa de uma pausa</li><li>Não se responsabilizar pelo que não é seu</li></ul></div>`);
  setTimeout(()=>api.showTyping(()=>{
    api.addAiMsg('Vamos fechar com um exercício de <strong>autocompaixão</strong>.\n\nImagine que um amigo querido te contasse tudo o que você vive como cuidador. Qual seria a primeira coisa que você diria a ele?',
    'Vamos fechar com um exercício de autocompaixão. Imagine que um amigo querido te contasse tudo o que você vive como cuidador. Qual seria a primeira coisa que você diria a ele?');
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Provavelmente você seria mais gentil com ele do que é com você mesmo(a).\n\n<em>Você merece essa mesma gentileza.</em>\n\n<strong>Jornada 5 concluída!</strong> 🌱','Provavelmente você seria mais gentil com ele do que é com você mesmo. Você merece essa mesma gentileza. Jornada 5 concluída!',
      `<div class="reflection"><div class="r-title">💭 Para guardar</div><div class="r-q">Qual é o menor gesto de cuidado que você poderia se dar hoje? Não amanhã. Hoje.<br><br>Nem que seja fechar os olhos por 3 minutos e respirar.</div></div>`);
      setTimeout(()=>api.addCtas([
        {icon:'▶️',label:'Continuar — Jornada 6',style:'primary',action: () => j6()},
        {icon:'📊',label:'Ver meu mapa',style:'secondary',action: () => api.showScreen('mapScreen')},
        {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
      ]),400);
    },2200),800);
  },2200),800);
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 6 — ESTRATÉGIAS DE MANEJO COM A CRIANÇA        ║
// ╚══════════════════════════════════════════════════════════╝
  function j6() { api.addUserMsg('Jornada 6 — Estratégias de Manejo 🛠️');
  api.showTyping(()=>{
    api.addAiMsg('Esta jornada é sobre o dia a dia com a criança.\n\nAntes de falarmos sobre estratégias, precisamos estabelecer uma base fundamental:\n\n<strong>Todo comportamento é comunicação.</strong>','Esta jornada é sobre o dia a dia com a criança. Antes de falarmos sobre estratégias, precisamos estabelecer uma base fundamental: todo comportamento é comunicação.',
    `<div class="hquote">A criança não está sendo difícil. Ela está tendo dificuldade.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Quando uma criança com TEA tem uma crise ou comportamento desafiador, ela está comunicando que:\n\n• Algo no ambiente está demais para ela\n• Ela não tem as ferramentas para expressar o que sente\n• Uma necessidade está sendo ignorada\n• A rotina foi quebrada de forma inesperada','Quando uma criança com TEA tem uma crise, ela está comunicando que algo no ambiente está demais para ela, ou que uma necessidade não está sendo atendida.',
      `<div class="info-card"><div class="ic-title">🧩 Antes de reagir, pergunte-se:</div><ul><li>O que a criança está tentando me dizer?</li><li>Qual necessidade não está sendo atendida?</li><li>Tem algo no ambiente que posso ajustar?</li><li>Ela tem as ferramentas para expressar isso?</li></ul></div>`);
      setTimeout(()=>api.showTyping(()=>{
        api.addPicker('Qual situação mais desafia você no dia a dia?','Qual situação mais desafia você no dia a dia?',
          [{emoji:'🌪️',label:'Crises e desregulação'},{emoji:'🔄',label:'Resistência à rotina'},{emoji:'💬',label:'Comunicação difícil'},{emoji:'👥',label:'Situações sociais'}],
          (idx,label)=>{
            profile.responses.push({type:'daily_challenge',value:label}); api.updateMap();
            const content = [
              [`<strong>Manejo de crises:</strong>`,`<div class="info-card"><div class="ic-title">🌊 Durante a crise</div><ul><li>Mantenha a calma — seu estado emocional afeta o dela</li><li>Reduza estímulos: luzes, sons, pessoas ao redor</li><li>Fale menos e mais devagar</li><li>Ofereça um espaço seguro e acolhedor</li><li>Não tente "ensinar" durante a crise — o cérebro não aprende sob estresse intenso</li></ul></div><div class="info-card" style="margin-top:8px"><div class="ic-title">🌱 Depois da crise</div><ul><li>Ofereça conforto sem cobrar explicações</li><li>Aguarde a criança se reorganizar no tempo dela</li><li>Reflita: o que pode ter desencadeado?</li></ul></div>`],
              [`<strong>Rotina e previsibilidade:</strong>`,`<div class="info-card"><div class="ic-title">🗓️ A rotina como âncora</div><ul><li>Antecipe mudanças com comunicação clara</li><li>Use recursos visuais: agenda, fotos, pictogramas</li><li>Avisos de transição: "Em 10 minutos vamos..."</li><li>Mantenha a previsibilidade mesmo em detalhes pequenos</li></ul></div>`],
              [`<strong>Comunicação funcional:</strong>`,`<div class="info-card"><div class="ic-title">💬 Comunicando melhor</div><ul><li>Frases curtas e diretas — sem linguagem figurada</li><li>Um pedido de cada vez</li><li>Dê tempo para processar a resposta</li><li>Ofereça escolhas simples: "Você quer A ou B?"</li><li>Valide antes de corrigir</li></ul></div>`],
              [`<strong>Situações sociais:</strong>`,`<div class="info-card"><div class="ic-title">👥 Preparando para o social</div><ul><li>Prepare antecipadamente: "Vamos a X e vai ter Y"</li><li>Crie uma estratégia de saída segura</li><li>Não force interação — apoie quando ela acontece</li><li>Celebre cada passo, mesmo os pequenos</li></ul></div>`]
            ];
            api.showTyping(()=>{
              api.addAiMsg(content[idx][0], content[idx][0].replace(/<[^>]+>/g,''), content[idx][1]);
              setTimeout(()=>api.showTyping(()=>{
                api.addAiMsg('<strong>Jornada 6 concluída!</strong> 🛠️\n\nEstratégias práticas são mais eficazes quando vêm de uma postura de compreensão, não de controle.','Jornada 6 concluída! Estratégias práticas são mais eficazes quando vêm de uma postura de compreensão.');
                setTimeout(()=>api.addCtas([
                  {icon:'▶️',label:'Continuar — Jornada 7',style:'primary',action: () => j7()},
                  {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
                ]),400);
              },2200),800);
            });
          });
      },2200),800);
    },2200),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 7 — A REDE DE APOIO                            ║
// ╚══════════════════════════════════════════════════════════╝
  function j7() { api.addUserMsg('Jornada 7 — A Rede de Apoio 🤝');
  api.showTyping(()=>{
    api.addAiMsg('Cuidar é um trabalho coletivo. 🤝\n\nAinda que muitas vezes pareça solitário, você não precisa — e não deveria — carregar tudo sozinho(a).','Cuidar é um trabalho coletivo. Ainda que muitas vezes pareça solitário, você não precisa carregar tudo sozinho.',
    `<div class="hquote">Uma rede de apoio frágil fragiliza o cuidador. Uma rede forte sustenta o cuidado.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addPicker('Como você descreveria sua rede de apoio atual?','Como você descreveria sua rede de apoio atual?',
        [{emoji:'🟢',label:'Tenho bom suporte'},{emoji:'🟡',label:'É limitada mas existe'},{emoji:'🔴',label:'Me sinto muito sozinho(a)'},{emoji:'🤷',label:'Não sei ao certo'}],
        (idx,label)=>{
          profile.supportNetwork = label; profile.responses.push({type:'support_network',value:label}); api.updateMap();
          const resp = [
            'Que bom! Uma rede de apoio sólida é um dos maiores fatores protetores da saúde mental do cuidador.',
            'Uma rede limitada ainda é uma rede. Vamos pensar em como fortalecê-la com pequenos passos.',
            'Sentir-se sozinho é muito pesado. Você não merece carregar isso assim. Vamos trabalhar isso juntos.',
            'Às vezes não percebemos o apoio que temos — ou as possibilidades que existem ao redor.'
          ];
          api.showTyping(()=>{
            api.addAiMsg(resp[idx]||resp[3], resp[idx]||resp[3]);
            setTimeout(()=>api.showTyping(()=>{
              api.addAiMsg('Sua rede de apoio pode incluir:\n\n• Família e amigos próximos\n• Outros pais de crianças com TEA\n• Profissionais de saúde da criança\n• Grupos de apoio presenciais ou online\n• Profissionais de saúde mental para você\n• Esta plataforma 💜','Sua rede de apoio pode incluir família, amigos, outros pais, profissionais e grupos de apoio.',
              `<div class="info-card"><div class="ic-title">💬 Como pedir ajuda</div><ul><li>Seja específico: "Preciso de ajuda com X"</li><li>Aceite ajuda sem se sentir em dívida</li><li>Você não precisa explicar tudo para ser ajudado</li><li>Pedir ajuda é ato de coragem, não de fraqueza</li></ul></div>`);
              setTimeout(()=>api.showTyping(()=>{
                api.addAiMsg('<strong>Jornada 7 concluída!</strong> 🤝\n\nSe este conteúdo despertou algo difícil, o plantão psicológico está disponível.','Jornada 7 concluída!');
                setTimeout(()=>api.addCtas([
                  {icon:'▶️',label:'Continuar — Jornada 8',style:'primary',action: () => j8()},
                  {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
                ]),400);
              },2000),800);
            },2200),800);
          });
        });
    },2200),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 8 — DIREITOS, DEVERES E ORIENTAÇÕES            ║
// ╚══════════════════════════════════════════════════════════╝
  function j8() { api.addUserMsg('Jornada 8 — Direitos, Deveres e Orientações 📋');
  api.showTyping(()=>{
    api.addAiMsg('Informação também é cuidado. 📋\n\nConhecer os direitos da criança com TEA e os seus como cuidador é uma ferramenta poderosa.','Informação também é cuidado. Conhecer os direitos da criança com TEA e os seus como cuidador é uma ferramenta poderosa.',
    `<div class="info-card"><div class="ic-title">🏛️ Lei Berenice Piana (Lei 12.764/2012)</div><ul><li>Garante atenção integral à saúde da pessoa com autismo</li><li>Assegura acesso ao diagnóstico precoce e tratamento</li><li>Garante atendimento multiprofissional no SUS</li><li>Proíbe a recusa de matrícula em escolas regulares</li></ul></div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Direitos essenciais da criança com TEA:\n\n• <strong>Inclusão escolar</strong> — direito à matrícula em escola regular com AEE\n• <strong>Atendimento no SUS</strong> — diagnóstico, terapias, acompanhamento\n• <strong>BPC</strong> — Benefício de Prestação Continuada para famílias de baixa renda\n• <strong>Passe livre</strong> em transporte interestadual\n• <strong>Isenção de IPTU</strong> em muitos municípios\n• <strong>Prioridade</strong> em filas e atendimentos','Direitos essenciais incluem inclusão escolar, atendimento no SUS, BPC para famílias de baixa renda, passe livre e prioridade em filas.',
      `<div class="info-card"><div class="ic-title">👨‍👩‍👧 Direitos do cuidador</div><ul><li>Possibilidade de redução de jornada de trabalho</li><li>Licença para acompanhar consultas e terapias</li><li>Proteção contra demissão durante tratamento do dependente em alguns estados</li></ul></div>`);
      setTimeout(()=>api.showTyping(()=>{
        api.addAiMsg('A inclusão escolar é um direito — mas na prática, pode exigir advocacy.\n\nAlgumas orientações:\n\n• Formalize pedidos sempre por escrito\n• Solicite o PEI (Plano Educacional Individualizado)\n• Reporte situações de exclusão ao Conselho Tutelar\n• Busque apoio em associações de autismo da sua região','A inclusão escolar é um direito. Mas na prática pode exigir advocacy. Formalize pedidos por escrito e solicite o Plano Educacional Individualizado.',
        `<div class="hquote">Você não precisa saber tudo. Precisa saber onde buscar ajuda — e que tem direito a ela.</div>`);
        setTimeout(()=>api.showTyping(()=>{
          api.addAiMsg('<strong>Jornada 8 concluída!</strong> 📋\n\nInformação empoderada é cuidado de qualidade.','Jornada 8 concluída! Informação empoderada é cuidado de qualidade.');
          setTimeout(()=>api.addCtas([
            {icon:'▶️',label:'Continuar — Jornada 9',style:'primary',action: () => j9()},
            {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
          ]),400);
        },2000),800);
      },2200),800);
    },2200),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 9 — MOMENTOS DE CRISE                          ║
// ╚══════════════════════════════════════════════════════════╝
  function j9() { api.addUserMsg('Jornada 9 — Momentos de Crise 🌊');
  api.showTyping(()=>{
    api.addAiMsg('Você está num momento difícil e eu estou aqui. 💙\n\nPrimeiro: <strong>respire.</strong>\n\nTudo o que você está sentindo é válido. Vamos dar um passo de cada vez.','Você está num momento difícil e eu estou aqui. Primeiro, respire. Tudo o que você está sentindo é válido. Vamos dar um passo de cada vez.',
    `<div class="reflection"><div class="r-title">🌬️ Exercício de respiração agora</div><div class="r-q">1. Inspire pelo nariz contando até 4<br>2. Segure contando até 4<br>3. Solte lentamente contando até 6<br><br>Repita 3 vezes. Isso ativa o sistema parassimpático e começa a desacelerar o estresse.</div></div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addPicker('Neste momento, como você está se sentindo?','Neste momento, como você está se sentindo?',
        [{emoji:'🌪️',label:'Em colapso, não consigo parar'},{emoji:'😰',label:'Muito ansioso e assustado'},{emoji:'😶',label:'Desligado, no automático'},{emoji:'😤',label:'Cheio de raiva e frustração'}],
        (idx,label)=>{
          profile.stressLevel = 9; profile.responses.push({type:'crisis_state',value:label}); api.updateMap();
          const resp = [
            'Colapso é o corpo dizendo "chega". Não significa que você falhou. Significa que você chegou no limite humano. Agora o mais importante é segurança — sua e da criança.',
            'A ansiedade intensa é muito angustiante. O corpo está em modo alerta máximo. A respiração pode ajudar a baixar esse nível.',
            'Desligar é uma forma de proteção quando o estresse é demais. É o cérebro tentando sobreviver. Você não precisa sentir tudo de uma vez.',
            'A raiva em situações de esgotamento é completamente normal. Ela frequentemente esconde dor, medo e exaustão.'
          ];
          api.showTyping(()=>{
            api.addAiMsg(resp[idx]||resp[0], resp[idx]||resp[0]);
            setTimeout(()=>api.showTyping(()=>{
              api.addAiMsg('Técnicas de regulação emocional rápidas:','Técnicas de regulação emocional rápidas:',
              `<div class="info-card"><div class="ic-title">⚡ Grounding 5-4-3-2-1</div><ul><li>5 coisas que você VÊ agora</li><li>4 coisas que você pode TOCAR</li><li>3 sons que você OUVE</li><li>2 cheiros que você sente</li><li>1 sabor</li></ul></div>
              <div class="info-card" style="margin-top:8px"><div class="ic-title">🧊 Quando a ansiedade é intensa</div><ul><li>Coloque água gelada no rosto ou pulsos</li><li>Aperte algo firme com as mãos</li><li>Caminhe descalço no chão</li><li>Fale em voz alta: "Estou aqui. Estou seguro(a)."</li></ul></div>`);
              setTimeout(()=>api.showTyping(()=>{
                api.addAiMsg('Depois da crise: <strong>acolhimento, não cobrança.</strong>\n\nNão é hora de avaliar o que deu errado.\nÉ hora de cuidar.','Depois da crise, acolhimento, não cobrança. Não é hora de avaliar o que deu errado. É hora de cuidar.',
                `<div class="hquote">Ter uma crise não te define. Como você se levanta depois dela, sim.</div>`);
                setTimeout(()=>api.addCtas([
                  {icon:'💜',label:'Falar com psicólogo AGORA',sub:'Plantão disponível 24h',style:'accent',action: () => api.openPsych()},
                  {icon:'🌱',label:'Jornada 5 — Cuidar de Si',style:'primary',action: () => j5()},
                  {icon:'📊',label:'Ver meu mapa',style:'secondary',action: () => api.showScreen('mapScreen')}
                ]),400);
              },2200),800);
            },2200),800);
          });
        });
    },2000),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 10 — COMO O CÉREBRO APRENDE                    ║
// ╚══════════════════════════════════════════════════════════╝
  function j10() { api.addUserMsg('Jornada 10 — Como o Cérebro Aprende ⚡');
  api.showTyping(()=>{
    api.addAiMsg('Entender o cérebro muda o cuidado. ⚡\n\nNesta jornada, vamos falar sobre <strong>neuroplasticidade</strong> — a capacidade do cérebro de se adaptar e aprender — sem pressão por desempenho.','Entender o cérebro muda o cuidado. Nesta jornada, vamos falar sobre neuroplasticidade, a capacidade do cérebro de se adaptar e aprender.',
    `<div class="hquote">O cérebro aprende ao longo de toda a vida. Não existe "janela perdida" — existe o melhor momento possível: agora.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('<strong>Neuroplasticidade</strong> significa que o cérebro forma novas conexões em resposta a experiências, aprendizado e suporte.\n\nIsso vale para TODAS as pessoas — incluindo pessoas com TEA.\n\nO que potencializa a neuroplasticidade:\n\n• Vínculo seguro e relação de confiança\n• Emoções positivas durante o aprendizado\n• Repetição com variação e motivação\n• Ambientes previsíveis e seguros\n• Sono de qualidade','Neuroplasticidade significa que o cérebro forma novas conexões em resposta a experiências e suporte. Isso vale para todas as pessoas, incluindo pessoas com TEA.',
      `<div class="info-card"><div class="ic-title">❤️ Vínculo como base do desenvolvimento</div><ul><li>A relação segura é o melhor "terapêuta"</li><li>Emoções reguladas do cuidador regulam as da criança</li><li>Momentos lúdicos e de prazer ativam o aprendizado</li><li>Sua presença já é uma intervenção</li></ul></div>`);
      setTimeout(()=>api.showTyping(()=>{
        api.addAiMsg('Pequenos avanços também são avanços.\n\nÀs vezes o progresso é invisível para os olhos — mas acontece no cérebro. Um novo som, um olhar diferente, uma nova palavra, uma regulação mais rápida.\n\n<strong>Celebre cada passo.</strong>','Pequenos avanços também são avanços. Às vezes o progresso é invisível para os olhos, mas acontece no cérebro. Celebre cada passo.',
        `<div class="info-card"><div class="ic-title">📊 O que NÃO acelera o desenvolvimento</div><ul><li>Pressão e cobrança excessiva</li><li>Comparação com outras crianças</li><li>Excesso de intervenções simultâneas</li><li>Ambiente de medo ou imprevisibilidade</li></ul></div>`);
        setTimeout(()=>api.showTyping(()=>{
          api.addAiMsg('<strong>Jornada 10 concluída!</strong> ⚡\n\nEntender o cérebro com mais ciência e menos julgamento transforma o cuidado.','Jornada 10 concluída! Entender o cérebro com mais ciência e menos julgamento transforma o cuidado.');
          setTimeout(()=>api.addCtas([
            {icon:'▶️',label:'Continuar — Jornada 11',style:'primary',action: () => j11()},
            {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
          ]),400);
        },2000),800);
      },2200),800);
    },2200),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 11 — POTENCIALIDADES, IDENTIDADE E FUTURO      ║
// ╚══════════════════════════════════════════════════════════╝
  function j11() { api.addUserMsg('Jornada 11 — Potencialidades, Identidade e Futuro 🌟');
  api.showTyping(()=>{
    api.addAiMsg('Esta jornada é sobre sair do modo sobrevivência e entrar no modo possibilidade. 🌟\n\nÉ sobre olhar para a criança com TEA e ver:\n\n<strong>Quem ela é além do diagnóstico.</strong>','Esta jornada é sobre sair do modo sobrevivência e entrar no modo possibilidade. É sobre olhar para a criança com TEA e ver quem ela é além do diagnóstico.',
    `<div class="hquote">O diagnóstico descreve algumas características. Não define a história.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addAiMsg('Toda criança com TEA tem potencialidades únicas.\n\nAlgumas características do TEA que podem se tornar grandes talentos:\n\n• Memória excepcional para assuntos de interesse\n• Atenção a detalhes que outros não percebem\n• Honestidade e pensamento direto\n• Criatividade em áreas específicas\n• Comprometimento profundo com o que ama','Toda criança com TEA tem potencialidades únicas. Características como memória excepcional, atenção a detalhes, honestidade e comprometimento profundo são comuns.',
      `<div class="info-card"><div class="ic-title">🔍 Exercício de olhar</div><ul><li>Quais são os interesses intensos dessa criança?</li><li>Em que momentos ela parece mais viva e engajada?</li><li>Qual habilidade ela demonstra que te surpreende?</li><li>O que ela faz que revela quem ela é de verdade?</li></ul></div>`);
      setTimeout(()=>api.showTyping(()=>{
        api.addAiMsg('Sobre o futuro:\n\n<strong>Esperança realista</strong> — não ilusão, não pessimismo.\n\nPessoas com TEA constroem vidas plenas com o suporte adequado. Cada criança tem seu próprio ritmo e trajetória.\n\nAdolescência e vida adulta existem e podem ser ricas — com autonomia possível em cada fase, redes de apoio fortes e identidade respeitada.','Sobre o futuro, esperança realista. Não ilusão, não pessimismo. Pessoas com TEA constroem vidas plenas com suporte adequado.',
        `<div class="hquote">Seu filho não precisa ser "curado". Ele precisa ser visto, apoiado e amado exatamente como é.</div>`);
        setTimeout(()=>api.showTyping(()=>{
          api.addAiMsg('<strong>Jornada 11 concluída!</strong> 🌟\n\nVocê está construindo uma visão mais completa — e isso faz toda a diferença.','Jornada 11 concluída! Você está construindo uma visão mais completa, e isso faz toda a diferença.');
          setTimeout(()=>api.addCtas([
            {icon:'▶️',label:'Continuar — Jornada 12',style:'primary',action: () => j12()},
            {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
          ]),400);
        },2000),800);
      },2200),800);
    },2200),800);
  });
}

// ╔══════════════════════════════════════════════════════════╗
// ║  JORNADA 12 — ESCOLA, SOCIEDADE E INCLUSÃO              ║
// ╚══════════════════════════════════════════════════════════╝
  function j12() { api.addUserMsg('Jornada 12 — Escola, Sociedade e Inclusão 🏫');
  api.showTyping(()=>{
    api.addAiMsg('Cuidar também é enfrentar o mundo. 🏫\n\nEsta jornada fala sobre algo que muitos cuidadores vivem com muita dor: <strong>a exclusão.</strong>\n\nNa escola, na rua, na família, na sociedade.','Cuidar também é enfrentar o mundo. Esta jornada fala sobre algo que muitos cuidadores vivem com muita dor: a exclusão. Na escola, na rua, na família, na sociedade.',
    `<div class="hquote">Inclusão de verdade não é tolerância. É pertencimento.</div>`);
    setTimeout(()=>api.showTyping(()=>{
      api.addPicker('Onde você encontra mais dificuldades relacionadas à inclusão?','Onde você encontra mais dificuldades relacionadas à inclusão?',
        [{emoji:'🏫',label:'Na escola da criança'},{emoji:'👨‍👩‍👧‍👦',label:'Na família e relações próximas'},{emoji:'🌍',label:'Na sociedade em geral'},{emoji:'💼',label:'No trabalho (minha própria inclusão)'}],
        (idx,label)=>{
          profile.responses.push({type:'inclusion_challenge',value:label}); api.updateMap();
          const content = [
            ['Na escola, a inclusão tem lei — mas nem sempre tem prática. Você tem direito a:\n\n• Reuniões com equipe pedagógica\n• Plano Educacional Individualizado (PEI)\n• Acompanhante especializado quando necessário\n• Adaptações no currículo e avaliações','Estratégias de comunicação com a escola:\n\n• Documente tudo por escrito (e-mails, atas)\n• Construa aliança com a professora, não confronto\n• Compartilhe o que funciona em casa\n• Solicite formação para a equipe quando necessário'],
            ['A família pode ser um dos maiores apoios — ou uma das maiores fontes de dor.\n\nComentários como "parece que é frescura" ou "você precisa ser mais firme" doem profundamente.','Como lidar com a família não compreensiva:\n\n• Estabeleça o que você precisa de cada pessoa\n• Não se gaste convencendo quem não quer entender\n• Cerque-se de quem valida sua experiência\n• Considere psicoeducação para familiares próximos'],
            ['O preconceito social ainda é grande. E enfrentá-lo dia a dia é exaustivo.\n\nVocê não precisa educar o mundo inteiro.','Como cuidar de si diante do preconceito social:\n\n• Escolha suas batalhas\n• Não se justifique para estranhos\n• Construa comunidade com outros cuidadores\n• Permita-se sentir raiva e tristeza — elas são válidas'],
            ['Sua inclusão no mercado de trabalho também importa.\n\nSer cuidador de criança com TEA impacta carreiras, finanças e identidade profissional.','Seus direitos trabalhistas:\n\n• Possibilidade de redução de jornada em alguns estados\n• Licenças para acompanhar tratamentos\n• Proteções específicas por estado — consulte um advogado trabalhista']
          ];
          api.showTyping(()=>{
            api.addAiMsg(content[idx][0], content[idx][0].replace(/<[^>]+>/g,''));
            setTimeout(()=>api.showTyping(()=>{
              api.addAiMsg(content[idx][1], content[idx][1].replace(/<[^>]+>/g,''),
              `<div class="hquote">Você não precisa sozinho(a) mudar a sociedade. Mas pode construir um círculo mais acolhedor ao redor da sua família.</div>`);
              setTimeout(()=>api.showTyping(()=>{
                api.addAiMsg('🎉 <strong>Parabéns! Você concluiu todas as 12 jornadas!</strong>\n\nEssa é uma conquista real. Você dedicou tempo e cuidado a entender sua própria jornada como cuidador.\n\nContinue aqui quando precisar — a Lia está sempre disponível. 💜','Parabéns! Você concluiu todas as 12 jornadas! Essa é uma conquista real. Você dedicou tempo e cuidado a entender sua própria jornada como cuidador. Continue aqui quando precisar. A Lia está sempre disponível.',
                `<div class="info-card"><div class="ic-title">🌸 Lembre sempre</div><ul><li>Você não está sozinho(a)</li><li>Você está fazendo o melhor que pode</li><li>Cuidar de si é cuidar da criança</li><li>Esta plataforma existe para você</li></ul></div>`);
                setTimeout(()=>api.addCtas([
                  {icon:'📊',label:'Ver meu mapa completo',style:'primary',action: () => api.showScreen('mapScreen')},
                  {icon:'🔄',label:'Revisitar jornadas',style:'secondary',action: () => api.showScreen('journeyScreen')},
                  {icon:'💜',label:'Falar com psicólogo',style:'accent',action: () => api.openPsych()}
                ]),400);
                api.setProgress(100);
              },2400),800);
            },2200),800);
          });
        });
    },2200),800);
  });
}


  return { startIntroFlow, sendMessage, handleMoodPick, startJourney };
}
